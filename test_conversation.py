"""
Test script to simulate the AI conversation flow WITHOUT Exotel.
Tests: LLM integration, state machine, knowledge base, language detection.

Usage:
    cd backend
    python -m scripts.test_conversation
"""
import sys
import os
import asyncio

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.llm import LLMService
from app.services.knowledge import KnowledgeService
from app.database import SessionLocal
from app.models import AgentConfig, InternshipDomain


def check_setup():
    """Verify DB is seeded and config exists before running test."""
    db = SessionLocal()
    try:
        internship = db.query(AgentConfig).filter(
            AgentConfig.agent_type == "internship",
            AgentConfig.is_active == 1
        ).first()
        if not internship:
            print("='=" * 30)
            print("  INTERNSHIP AGENT NOT FOUND IN DATABASE.")
            print("  Run 'python -m scripts.seed' first to populate default data.")
            print("='=" * 30)
            return False

        domains = db.query(InternshipDomain).count()
        print(f"  Agent config found: {internship.agent_type}")
        print(f"  Domains in DB: {domains}")
        return True
    finally:
        db.close()


def print_header(title):
    width = 60
    print()
    print("=" * width)
    print(f"  {title}")
    print("=" * width)


def print_conversation_turn(turn_num, user_input, response):
    print(f"\n{'─' * 50}")
    print(f"  Turn #{turn_num}")
    print(f"  User: {user_input}")
    print(f"  AI:   {response.get('message', '')[:200]}")
    print(f"  Action: {response.get('action', '?')}")
    data = response.get('collected_data', {})
    if data:
        print(f"  Data: {data}")
    print(f"{'─' * 50}")


async def simulate_conversation():
    print_header("AI CONVERSATION TEST SUITE")
    print("  This simulates a call conversation end-to-end using")
    print("  OpenRouter (Deepseek) + Conversation state machine.\n")

    if not check_setup():
        return

    llm = LLMService()
    manager = llm.get_conversation_manager("internship")
    call_sid = "test_call_001"

    # ---- Test 1: Greeting / FAQ ----
    print_header("TEST 1: FAQ Question (Domains)")
    resp = await llm.process_conversation(
        "What internship domains do you offer?", call_sid, "internship"
    )
    print_conversation_turn(1, "What internship domains do you offer?", resp)
    assert resp.get("action") in ("ask_registration", "collect_details", "continue"), \
        f"Expected ask_registration/collect_details, got {resp.get('action')}"

    # ---- Test 2: Start registration ----
    print_header("TEST 2: Start Registration (Yes)")
    resp = await llm.process_conversation("Yes", call_sid, "internship")
    print_conversation_turn(2, "Yes", resp)
    assert resp.get("action") == "collect_details", f"Expected collect_details, got {resp.get('action')}"

    # ---- Test 3: Provide name ----
    print_header("TEST 3: Collect Name")
    resp = await llm.process_conversation("My name is John Doe", call_sid, "internship")
    print_conversation_turn(3, "My name is John Doe", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 4: Provide college ----
    print_header("TEST 4: Collect College")
    resp = await llm.process_conversation("I study at Anna University", call_sid, "internship")
    print_conversation_turn(4, "I study at Anna University", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 5: Provide domain ----
    print_header("TEST 5: Collect Domain")
    resp = await llm.process_conversation("I'm interested in AI and Machine Learning", call_sid, "internship")
    print_conversation_turn(5, "I'm interested in AI and Machine Learning", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 6: Provide joining date ----
    print_header("TEST 6: Collect Joining Date")
    resp = await llm.process_conversation("I want to join next month", call_sid, "internship")
    print_conversation_turn(6, "I want to join next month", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 7: Provide duration ----
    print_header("TEST 7: Collect Duration")
    resp = await llm.process_conversation("3 months", call_sid, "internship")
    print_conversation_turn(7, "3 months", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 8: Provide batch ----
    print_header("TEST 8: Collect Batch")
    resp = await llm.process_conversation("Morning batch", call_sid, "internship")
    print_conversation_turn(8, "Morning batch", resp)
    assert resp.get("action") == "collect_details"

    # ---- Test 9: Provide contact ----
    print_header("TEST 9: Collect Contact")
    resp = await llm.process_conversation("My number is 9876543210", call_sid, "internship")
    print_conversation_turn(9, "My number is 9876543210", resp)
    assert resp.get("action") == "check_slots"

    # ---- Test 10: Confirm ----
    print_header("TEST 10: Confirm Registration")
    resp = await llm.process_conversation("Yes, please confirm", call_sid, "internship")
    print_conversation_turn(10, "Yes, please confirm", resp)
    assert resp.get("action") in ("confirm", "completed"), f"Expected confirm/completed, got {resp.get('action')}"

    # ---- Test 11: Final confirmation ----
    print_header("TEST 11: Final Yes")
    resp = await llm.process_conversation("Yes, confirm", call_sid, "internship")
    print_conversation_turn(11, "Yes, confirm", resp)
    assert resp.get("action") == "completed", f"Expected completed, got {resp.get('action')}"

    # ---- Summary ----
    data = manager.get_session_data(call_sid)
    print_header("TEST RESULTS")
    print(f"  Final Stage: {data.get('stage')}")
    print(f"  Language:    {data.get('language')}")
    print(f"  Messages:    {len(data.get('messages', []))}")
    print(f"  Collected:")
    for k, v in data.get('collected_data', {}).items():
        print(f"    {k}: {v}")
    print()
    print("  ALL TESTS PASSED!")


async def test_tamil_detection():
    """Test Tamil language detection."""
    print_header("TEST TAMIL LANGUAGE DETECTION")
    call_sid = "test_tamil_001"
    llm = LLMService()

    resp = await llm.process_conversation("Vanakkam, internship pathi therinjikanum", call_sid, "internship")
    session = llm.get_conversation_manager("internship").get_or_create_session(call_sid)
    print(f"  User: Vanakkam, internship pathi therinjikanum")
    print(f"  AI:   {resp.get('message', '')[:150]}")
    print(f"  Lang: {session.get('language', '?')}")

    if session.get("language") == "tamil":
        print("  TAMIL DETECTION: PASSED")
    else:
        print("  TAMIL DETECTION: FAILED (expected 'tamil')")

    llm.get_conversation_manager("internship").clear_session(call_sid)


async def test_no_input_handling():
    """Test how the system handles empty/unknown input."""
    print_header("TEST EMPTY INPUT HANDLING")
    call_sid = "test_empty_001"
    llm = LLMService()

    resp = await llm.process_conversation("", call_sid, "internship")
    print(f"  User: (empty)")
    print(f"  AI:   {resp.get('message', '')[:150]}")
    print(f"  Action: {resp.get('action', '?')}")

    llm.get_conversation_manager("internship").clear_session(call_sid)


async def main():
    try:
        await simulate_conversation()
    except Exception as e:
        print(f"\n  ERROR: {e}")
        import traceback
        traceback.print_exc()

    print()
    try:
        await test_tamil_detection()
    except Exception as e:
        print(f"\n  ERROR in Tamil test: {e}")

    print()
    try:
        await test_no_input_handling()
    except Exception as e:
        print(f"\n  ERROR in empty input test: {e}")

    print("\n" + "=" * 60)
    print("  Conversation test script complete.")
    print("  Tip: Check the backend logs for detailed API call info.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

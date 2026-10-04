from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from app.database import get_db
from app.models import SlotManagement, SlotDomainAllocation, BatchType, InternshipDomain
from app.schemas import (
    SlotCreate, SlotUpdate, SlotResponse,
    SlotDomainAllocationCreate, SlotDomainAllocationUpdate, SlotDomainAllocationResponse,
)

router = APIRouter(prefix="/api/slots", tags=["Slot Management"])


@router.get("/", response_model=List[SlotResponse])
def list_slots(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    batch: Optional[BatchType] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(SlotManagement)
    if date_from:
        query = query.filter(SlotManagement.date >= date_from)
    if date_to:
        query = query.filter(SlotManagement.date <= date_to)
    if batch:
        query = query.filter(SlotManagement.batch == batch)
    return query.order_by(SlotManagement.date, SlotManagement.batch).all()


@router.get("/{slot_id}/allocations", response_model=List[SlotDomainAllocationResponse])
def list_slot_allocations(slot_id: int, db: Session = Depends(get_db)):
    slot = db.query(SlotManagement).filter(SlotManagement.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    allocations = db.query(SlotDomainAllocation).filter(
        SlotDomainAllocation.slot_id == slot_id
    ).all()
    result = []
    for a in allocations:
        domain = db.query(InternshipDomain).filter(InternshipDomain.id == a.domain_id).first()
        result.append(SlotDomainAllocationResponse(
            id=a.id,
            slot_id=a.slot_id,
            domain_id=a.domain_id,
            domain_name=domain.name if domain else None,
            max_capacity=a.max_capacity,
            occupied=a.occupied,
            available=a.available,
        ))
    return result


@router.post("/{slot_id}/allocations", response_model=SlotDomainAllocationResponse, status_code=201)
def create_slot_allocation(slot_id: int, data: SlotDomainAllocationCreate, db: Session = Depends(get_db)):
    slot = db.query(SlotManagement).filter(SlotManagement.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == data.domain_id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    existing = db.query(SlotDomainAllocation).filter(
        SlotDomainAllocation.slot_id == slot_id,
        SlotDomainAllocation.domain_id == data.domain_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Allocation already exists for this domain in this slot")

    max_capacity = data.max_capacity
    total_allocated = db.query(func.coalesce(func.sum(SlotDomainAllocation.max_capacity), 0)).filter(
        SlotDomainAllocation.slot_id == slot_id
    ).scalar() or 0

    if total_allocated + max_capacity > slot.capacity:
        raise HTTPException(
            status_code=400,
            detail=f"Total domain allocations ({total_allocated + max_capacity}) would exceed slot capacity ({slot.capacity})"
        )

    allocation = SlotDomainAllocation(slot_id=slot_id, domain_id=data.domain_id, max_capacity=max_capacity)
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return SlotDomainAllocationResponse(
        id=allocation.id,
        slot_id=allocation.slot_id,
        domain_id=allocation.domain_id,
        domain_name=domain.name,
        max_capacity=allocation.max_capacity,
        occupied=allocation.occupied,
        available=allocation.available,
    )


@router.put("/allocations/{allocation_id}", response_model=SlotDomainAllocationResponse)
def update_slot_allocation(allocation_id: int, data: SlotDomainAllocationUpdate, db: Session = Depends(get_db)):
    allocation = db.query(SlotDomainAllocation).filter(SlotDomainAllocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")

    if data.max_capacity is not None:
        if data.max_capacity < allocation.occupied:
            raise HTTPException(
                status_code=400,
                detail=f"New max ({data.max_capacity}) is less than currently occupied ({allocation.occupied})"
            )
        slot = db.query(SlotManagement).filter(SlotManagement.id == allocation.slot_id).first()
        other_allocated = db.query(func.coalesce(func.sum(SlotDomainAllocation.max_capacity), 0)).filter(
            SlotDomainAllocation.slot_id == allocation.slot_id,
            SlotDomainAllocation.id != allocation_id,
        ).scalar() or 0
        if other_allocated + data.max_capacity > slot.capacity:
            raise HTTPException(
                status_code=400,
                detail=f"Updated total ({other_allocated + data.max_capacity}) would exceed slot capacity ({slot.capacity})"
            )
        allocation.max_capacity = data.max_capacity

    db.commit()
    db.refresh(allocation)
    domain = db.query(InternshipDomain).filter(InternshipDomain.id == allocation.domain_id).first()
    return SlotDomainAllocationResponse(
        id=allocation.id,
        slot_id=allocation.slot_id,
        domain_id=allocation.domain_id,
        domain_name=domain.name if domain else None,
        max_capacity=allocation.max_capacity,
        occupied=allocation.occupied,
        available=allocation.available,
    )


@router.delete("/allocations/{allocation_id}")
def delete_slot_allocation(allocation_id: int, db: Session = Depends(get_db)):
    allocation = db.query(SlotDomainAllocation).filter(SlotDomainAllocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(allocation)
    db.commit()
    return {"message": "Allocation deleted"}


@router.get("/check")
def check_slot_availability(
    date: date = Query(...),
    batch: BatchType = Query(...),
    domain_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    slot = db.query(SlotManagement).filter(
        SlotManagement.date == date,
        SlotManagement.batch == batch
    ).first()
    if not slot:
        return {"available": True, "message": "No slot configuration found, assuming available"}

    main_available = slot.capacity - slot.occupied

    if domain_id:
        allocation = db.query(SlotDomainAllocation).filter(
            SlotDomainAllocation.slot_id == slot.id,
            SlotDomainAllocation.domain_id == domain_id,
        ).first()
        if allocation:
            domain_available = allocation.available
            return {
                "date": date,
                "batch": batch.value,
                "slot_capacity": slot.capacity,
                "slot_occupied": slot.occupied,
                "domain_id": domain_id,
                "domain_max": allocation.max_capacity,
                "domain_occupied": allocation.occupied,
                "domain_available": domain_available,
                "available": min(main_available, domain_available),
                "is_full": domain_available <= 0,
            }

    return {
        "date": date,
        "batch": batch.value,
        "slot_capacity": slot.capacity,
        "slot_occupied": slot.occupied,
        "available": main_available,
        "is_full": main_available <= 0,
    }


@router.get("/next-available")
def get_next_available_slot(
    batch: Optional[BatchType] = Query(None),
    domain_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(SlotManagement).filter(
        SlotManagement.date >= date.today(),
        SlotManagement.occupied < SlotManagement.capacity
    )
    if batch:
        query = query.filter(SlotManagement.batch == batch)
    slot = query.order_by(SlotManagement.date, SlotManagement.batch).first()
    if not slot:
        return {"available": False, "message": "No available slots found"}

    available = slot.capacity - slot.occupied

    if domain_id:
        allocation = db.query(SlotDomainAllocation).filter(
            SlotDomainAllocation.slot_id == slot.id,
            SlotDomainAllocation.domain_id == domain_id,
        ).first()
        if allocation:
            available = min(available, allocation.available)
            if available <= 0:
                return {"available": False, "message": "Domain allocation is full in next available slot"}

    return {
        "date": slot.date,
        "batch": slot.batch.value,
        "available": available,
        "message": f"Slots available on {slot.date} for {slot.batch.value} batch"
    }


@router.post("/", response_model=SlotResponse, status_code=201)
def create_slot(data: SlotCreate, db: Session = Depends(get_db)):
    existing = db.query(SlotManagement).filter(
        SlotManagement.date == data.date,
        SlotManagement.batch == data.batch,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slot already exists for this date and batch")
    slot = SlotManagement(**data.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.put("/{slot_id}", response_model=SlotResponse)
def update_slot(slot_id: int, data: SlotUpdate, db: Session = Depends(get_db)):
    slot = db.query(SlotManagement).filter(SlotManagement.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if data.capacity is not None:
        if data.capacity < slot.occupied:
            raise HTTPException(
                status_code=400,
                detail=f"New capacity ({data.capacity}) is less than currently occupied ({slot.occupied})"
            )

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(slot, key, value)
    db.commit()
    db.refresh(slot)
    return slot


@router.post("/reserve")
def reserve_slot(
    date: date = Query(...),
    batch: BatchType = Query(...),
    domain_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    slot = db.query(SlotManagement).filter(
        SlotManagement.date == date,
        SlotManagement.batch == batch,
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.occupied >= slot.capacity:
        raise HTTPException(status_code=400, detail="Slot is full")

    if domain_id:
        allocation = db.query(SlotDomainAllocation).filter(
            SlotDomainAllocation.slot_id == slot.id,
            SlotDomainAllocation.domain_id == domain_id,
        ).first()
        if not allocation:
            raise HTTPException(status_code=404, detail="Domain allocation not found for this slot")
        if allocation.occupied >= allocation.max_capacity:
            raise HTTPException(status_code=400, detail="Domain allocation is full")

        allocation.occupied += 1

    slot.occupied += 1
    db.commit()
    db.refresh(slot)
    return {"message": "Slot reserved successfully", "remaining": slot.capacity - slot.occupied}


@router.get("/summary")
def get_slot_summary(
    date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    target_date = date or date.today()
    slots = db.query(SlotManagement).filter(
        SlotManagement.date == target_date
    ).all()

    summary = []
    for slot in slots:
        allocations = db.query(SlotDomainAllocation).filter(
            SlotDomainAllocation.slot_id == slot.id
        ).all()
        domain_breakdown = []
        for a in allocations:
            domain = db.query(InternshipDomain).filter(InternshipDomain.id == a.domain_id).first()
            domain_breakdown.append({
                "domain_id": a.domain_id,
                "domain_name": domain.name if domain else "Unknown",
                "max_capacity": a.max_capacity,
                "occupied": a.occupied,
                "available": a.available,
            })
        summary.append({
            "slot_id": slot.id,
            "date": str(slot.date),
            "batch": slot.batch.value,
            "total_capacity": slot.capacity,
            "total_occupied": slot.occupied,
            "total_available": slot.available,
            "domain_allocations": domain_breakdown,
        })

    return summary

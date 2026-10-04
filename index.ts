export interface DashboardStats {
  total_calls: number
  today_calls: number
  confirmed_students: number
  pending_students: number
  cancelled_students: number
  total_students: number
  available_slots: number
}

export interface CallLog {
  id: number
  student_id: number | null
  call_type: 'inbound' | 'outbound'
  call_sid: string | null
  timestamp: string
  duration: number
  transcript: string | null
  recording_url: string | null
  outcome: string | null
  ai_summary: string | null
  language: string
  caller_number: string | null
  ivr_option: string | null
  agent_type: string | null
  call_notes: string | null
}

export interface Student {
  id: number
  name: string
  college: string
  domain: string
  contact_number: string
  joining_date: string
  duration: string
  batch: string
  status: string
  document_status: string
  missed_joining_reason: string | null
  rescheduled_date: string | null
  rescheduled_batch: string | null
  created_at: string
}

export interface StudentFilter {
  name?: string
  college?: string
  domain?: string
  batch?: string
  status?: string
  document_status?: string
}

export interface PendingFollowupStudent {
  id: number
  name: string
  college: string
  domain: string
  contact_number: string
  joining_date: string
  duration: string
  batch: string
  status: string
  document_status: string
  reason: string
  created_at: string
}

export interface PendingFollowupSegment {
  segment: string
  label: string
  count: number
  students: PendingFollowupStudent[]
}

export interface BulkCallResult {
  student_id: number
  student_name: string
  contact_number: string
  call_sid: string | null
  status: string
}

export interface BulkCallResponse {
  total: number
  queued: number
  results: BulkCallResult[]
}

export interface Slot {
  id: number
  date: string
  batch: string
  capacity: number
  occupied: number
  available: number
}

export interface SlotDomainAllocation {
  id: number
  slot_id: number
  domain_id: number
  domain_name: string | null
  max_capacity: number
  occupied: number
  available: number
}

export interface SlotSummary {
  slot_id: number
  date: string
  batch: string
  total_capacity: number
  total_occupied: number
  total_available: number
  domain_allocations: SlotDomainAllocation[]
}

export interface AgentConfig {
  id: number
  agent_type: string
  system_prompt: string
  greeting_message: string
  voice: string
  ai_model: string
  temperature: number
  max_tokens: number
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface AnalyticsSummary {
  total_calls: number
  inbound_calls: number
  outbound_calls: number
  avg_duration_seconds: number
  ivr_breakdown: Record<string, number>
  outcome_breakdown: Record<string, number>
  call_volume: { date: string; count: number }[]
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  per_page: number
  total_pages: number
  items: T[]
}

export interface CallTranscript {
  id: number
  call_sid: string
  timestamp: string
  transcript: string
  ai_summary: string
  call_notes: string
  duration: number
  outcome: string | null
  ivr_option: string | null
  agent_type: string | null
}

export interface InternshipDomain {
  id: number
  name: string
  description: string | null
  duration_options: string | null
  eligibility: string | null
  skills_learned: string | null
  career_prospects: string | null
  fee_structure: string | null
  prerequisites: string | null
  tools_covered: string | null
  project_details: string | null
  certification_details: string | null
  mode: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string | null
}

export interface DomainBatch {
  id: number
  domain_id: number
  batch_name: string
  start_date: string | null
  end_date: string | null
  capacity: number
  occupied: number
  available: number
  schedule: string | null
  is_active: boolean
  created_at: string
}

export interface KnowledgeEntry {
  id: number
  category: string
  key: string
  content: string
  tags: string | null
  language: string
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface PromptTemplate {
  id: number
  agent_type: string
  template_key: string
  template_text: string
  variables: any
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface FaqEntry {
  id: number
  question: string
  answer: string
  keywords: string | null
  category: string | null
  language: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string | null
}

export interface BusinessHours {
  id: number
  day_of_week: number
  open_time: string
  close_time: string
  is_working_day: boolean
  created_at: string
  updated_at: string | null
}

export interface Holiday {
  id: number
  date: string
  description: string | null
  is_recurring_yearly: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  entity_type: string
  entity_id: number | null
  action: string
  changes: any
  performed_by: string | null
  timestamp: string
}

export interface ContextPreview {
  domain_context: string
  knowledge_context: string
  faq_context: string
  availability_context: string
}

export interface DomainAnalytics {
  domain_id: number
  domain_name: string
  mention_count: number
  confirmed_count: number
  conversion_rate: number
  popularity_percentage: number
}

export interface AITrainingContent {
  id: number
  agent_type: string
  topic: string
  content: string
  category: string | null
  priority: number
  config_metadata: any
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface AgentPerformance {
  agent_type: string
  total_calls: number
  total_duration_seconds: number
  confirmed_count: number
  conversion_rate: number
}

export interface AIAddStudentResponse {
  student: Student
  ai_parsed: Record<string, any>
  action: string
}

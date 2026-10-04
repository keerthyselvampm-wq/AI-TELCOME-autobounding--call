const API_BASE = '/api'

let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  })

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vdart_auth')
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please login again.')
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.detail || error.message || errorMsg
    } catch { }
    throw new Error(errorMsg)
  }

  if (response.status === 204) return undefined as any
  return response.json()
}

export const api = {
  setToken,
  auth: {
    login: (username: string, password: string) =>
      request<{ access_token: string; token_type: string; username: string; role: string }>(
        '/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }
      ),
    register: (username: string, password: string, secretKey: string) =>
      request<{ access_token: string; token_type: string; username: string; role: string }>(
        '/auth/register', { method: 'POST', body: JSON.stringify({ username, password, secret_key: secretKey }) }
      ),
  },
  exotel: {
    makeTestCall: (toNumber: string) =>
      request<{ call_sid: string; status: string }>('/exotel/make-test-call', { method: 'POST', body: JSON.stringify({ to_number: toNumber }) }),
    diagnostics: () => request<any>('/diagnostics'),
    bulkCall: (data: { student_ids: number[]; agent_type?: string; delay_seconds?: number }) =>
      request<any>('/exotel/bulk-call', { method: 'POST', body: JSON.stringify(data) }),
  },
  students: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/students/${query}`)
    },
    get: (id: number) => request<any>(`/students/${id}`),
    create: (data: any) => request<any>('/students/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/students/${id}`, { method: 'DELETE' }),
    exportCsv: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      window.open(`${API_BASE}/students/export/csv${query}`, '_blank')
    },
    pendingFollowup: () => request<any[]>('/students/pending-followup'),
    aiAdd: (data: { text: string; student_id?: number }) =>
      request<{ student: any; ai_parsed: any; action: string }>('/students/ai-add', { method: 'POST', body: JSON.stringify(data) }),
  },
  calls: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/calls/${query}`)
    },
    get: (id: number) => request<any>(`/calls/${id}`),
  },
  slots: {
    list: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/slots/${query}`)
    },
    create: (data: any) => request<any>('/slots/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/slots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    check: (date: string, batch: string, domain_id?: number) => {
      let url = `/slots/check?date=${date}&batch=${batch}`
      if (domain_id) url += `&domain_id=${domain_id}`
      return request<any>(url)
    },
    nextAvailable: (batch?: string, domain_id?: number) => {
      const params = new URLSearchParams()
      if (batch) params.set('batch', batch)
      if (domain_id) params.set('domain_id', String(domain_id))
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<any>(`/slots/next-available${query}`)
    },
    reserve: (date: string, batch: string, domain_id?: number) => {
      let url = `/slots/reserve?date=${date}&batch=${batch}`
      if (domain_id) url += `&domain_id=${domain_id}`
      return request<any>(url, { method: 'POST' })
    },
    summary: (date?: string) => {
      const query = date ? `?date=${date}` : ''
      return request<any[]>(`/slots/summary${query}`)
    },
    listAllocations: (slotId: number) => request<any[]>(`/slots/${slotId}/allocations`),
    createAllocation: (slotId: number, data: any) => request<any>(`/slots/${slotId}/allocations`, { method: 'POST', body: JSON.stringify(data) }),
    updateAllocation: (allocationId: number, data: any) => request<any>(`/slots/allocations/${allocationId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAllocation: (allocationId: number) => request<void>(`/slots/allocations/${allocationId}`, { method: 'DELETE' }),
  },
  dashboard: {
    stats: () => request<any>('/dashboard/stats'),
    batchOccupancy: () => request<any>('/dashboard/batch-occupancy'),
    callVolume: (days?: number) => request<any>(`/dashboard/call-volume${days ? `?days=${days}` : ''}`),
    recentActivities: (limit?: number) => request<any>(`/dashboard/recent-activities${limit ? `?limit=${limit}` : ''}`),
  },
  health: () => request<any>('/health'),
  admin: {
    listAgents: () => request<any[]>('/admin/agents/'),
    getAgent: (type: string) => request<any>(`/admin/agents/${type}`),
    createAgent: (data: any) => request<any>('/admin/agents/', { method: 'POST', body: JSON.stringify(data) }),
    updateAgent: (type: string, data: any) => request<any>(`/admin/agents/${type}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteAgent: (type: string) => request<void>(`/admin/agents/${type}`, { method: 'DELETE' }),
    listDomains: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any[]>(`/admin/domains/${query}`)
    },
    getDomain: (id: number) => request<any>(`/admin/domains/${id}`),
    createDomain: (data: any) => request<any>('/admin/domains/', { method: 'POST', body: JSON.stringify(data) }),
    updateDomain: (id: number, data: any) => request<any>(`/admin/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDomain: (id: number) => request<void>(`/admin/domains/${id}`, { method: 'DELETE' }),
    listDomainBatches: (domainId: number) => request<any[]>(`/admin/domains/${domainId}/batches`),
    createDomainBatch: (domainId: number, data: any) => request<any>(`/admin/domains/${domainId}/batches`, { method: 'POST', body: JSON.stringify(data) }),
    updateBatch: (batchId: number, data: any) => request<any>(`/admin/batches/${batchId}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBatch: (batchId: number) => request<void>(`/admin/batches/${batchId}`, { method: 'DELETE' }),
    listKnowledge: (category?: string) => {
      const query = category ? `?category=${category}` : ''
      return request<any[]>(`/admin/knowledge/${query}`)
    },
    createKnowledge: (data: any) => request<any>('/admin/knowledge/', { method: 'POST', body: JSON.stringify(data) }),
    updateKnowledge: (id: number, data: any) => request<any>(`/admin/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteKnowledge: (id: number) => request<void>(`/admin/knowledge/${id}`, { method: 'DELETE' }),
    listPrompts: (agentType?: string) => {
      const query = agentType ? `?agent_type=${agentType}` : ''
      return request<any[]>(`/admin/prompts/${query}`)
    },
    createPrompt: (data: any) => request<any>('/admin/prompts/', { method: 'POST', body: JSON.stringify(data) }),
    updatePrompt: (id: number, data: any) => request<any>(`/admin/prompts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deletePrompt: (id: number) => request<void>(`/admin/prompts/${id}`, { method: 'DELETE' }),
    listFaqs: (category?: string) => {
      const query = category ? `?category=${category}` : ''
      return request<any[]>(`/admin/faqs/${query}`)
    },
    createFaq: (data: any) => request<any>('/admin/faqs/', { method: 'POST', body: JSON.stringify(data) }),
    updateFaq: (id: number, data: any) => request<any>(`/admin/faqs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteFaq: (id: number) => request<void>(`/admin/faqs/${id}`, { method: 'DELETE' }),
    listBusinessHours: () => request<any[]>('/admin/business-hours/'),
    updateBusinessHours: (id: number, data: any) => request<any>(`/admin/business-hours/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    listHolidays: (year?: number) => {
      const query = year ? `?year=${year}` : ''
      return request<any[]>(`/admin/holidays/${query}`)
    },
    createHoliday: (data: any) => request<any>('/admin/holidays/', { method: 'POST', body: JSON.stringify(data) }),
    updateHoliday: (id: number, data: any) => request<any>(`/admin/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteHoliday: (id: number) => request<void>(`/admin/holidays/${id}`, { method: 'DELETE' }),
    listAuditLogs: (entityType?: string, limit?: number) => {
      const params = new URLSearchParams()
      if (entityType) params.set('entity_type', entityType)
      if (limit) params.set('limit', String(limit))
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<any[]>(`/admin/audit-logs/${query}`)
    },
    getContextPreview: (agentType: string) => request<any>(`/admin/context-preview?agent_type=${agentType}`),
    listTraining: (agentType?: string, category?: string) => {
      const params = new URLSearchParams()
      if (agentType) params.set('agent_type', agentType)
      if (category) params.set('category', category)
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<any[]>(`/admin/training/${query}`)
    },
    getTraining: (id: number) => request<any>(`/admin/training/${id}`),
    createTraining: (data: any) => request<any>('/admin/training/', { method: 'POST', body: JSON.stringify(data) }),
    updateTraining: (id: number, data: any) => request<any>(`/admin/training/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTraining: (id: number) => request<void>(`/admin/training/${id}`, { method: 'DELETE' }),
  },
  analytics: {
    summary: (days?: number) => request<any>(`/analytics/summary${days ? `?days=${days}` : ''}`),
    calls: (params?: Record<string, string>) => {
      const query = params ? '?' + new URLSearchParams(params).toString() : ''
      return request<any>(`/analytics/calls${query}`)
    },
    transcript: (id: number) => request<any>(`/analytics/calls/${id}/transcript`),
    downloadTranscript: (id: number) => {
      window.open(`/api/analytics/calls/${id}/transcript/download`, '_blank')
    },
    domains: (days?: number) => request<any>(`/analytics/domains${days ? `?days=${days}` : ''}`),
    ivrTrends: (days?: number) => request<any>(`/analytics/ivr-trends${days ? `?days=${days}` : ''}`),
    agentPerformance: (days?: number) => request<any>(`/analytics/agent-performance${days ? `?days=${days}` : ''}`),
  },
}

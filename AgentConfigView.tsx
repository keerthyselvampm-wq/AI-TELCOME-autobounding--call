import { useEffect, useState } from 'react'
import { Save, RefreshCw, Bot, Trash2, Edit2 } from 'lucide-react'
import { api } from '../../api/client'
import type { AgentConfig } from '../../types'
import ConfirmDialog from '../../components/admin/ConfirmDialog'
import Toast from '../../components/admin/Toast'

export default function AgentConfigView() {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  useEffect(() => {
    api.admin.listAgents().then(setAgents).finally(() => setLoading(false))
  }, [])

  const startEdit = (agent: AgentConfig) => {
    setEditing(agent.agent_type)
    setEditForm({ ...agent, is_active: Boolean(agent.is_active) })
  }

  const saveAgent = async () => {
    if (!editing) return
    setSaving(true)
    setToast(null)
    try {
      await api.admin.updateAgent(editing, editForm)
      setToast({ type: 'success', text: 'Agent configuration saved successfully' })
      setEditing(null)
      const updated = await api.admin.listAgents()
      setAgents(updated)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'Failed to save' })
    }
    setSaving(false)
  }

  const deleteAgent = async () => {
    if (!confirm) return
    try {
      await api.admin.deleteAgent(confirm)
      setToast({ type: 'success', text: 'Agent deleted' })
      setConfirm(null)
      const updated = await api.admin.listAgents()
      setAgents(updated)
    } catch (err: any) {
      setToast({ type: 'error', text: err.message })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  const agentTypes = ['internship']
  const agentLabels: Record<string, string> = {
    internship: 'Internship Enquiry Agent',
  }
  const agentColors: Record<string, string> = {
    internship: 'text-blue-600 bg-blue-50',
  }

  return (
    <div>
      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDialog
        open={confirm !== null}
        title="Delete Agent"
        message="Are you sure you want to delete this agent configuration? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={deleteAgent}
        onCancel={() => setConfirm(null)}
      />

      <h1 className="text-2xl font-bold text-gray-900">Agent Configuration</h1>
      <p className="text-sm text-gray-500 mb-6">Manage AI agent settings and parameters</p>

      <div className="grid grid-cols-1 gap-6">
        {agentTypes.map((type) => {
          const agent = agents.find((a) => a.agent_type === type)
          const isEditing = editing === type
          const form = isEditing ? editForm : agent || { agent_type: type, system_prompt: '', greeting_message: '', voice: 'default', ai_model: 'deepseek/deepseek-chat-v3-0615', temperature: 70, max_tokens: 300, is_active: false }

          return (
            <div key={type} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
                <div className={`shrink-0 p-2 rounded-lg ${agentColors[type]}`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{agentLabels[type]}</h3>
                  {!isEditing && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${form.is_active ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20' : 'bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-600/20'}`}>
                      {form.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => startEdit(form as AgentConfig)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-150" title="Edit agent">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirm(type)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all duration-150" title="Delete agent">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Greeting Message</label>
                    <input className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.greeting_message || ''} onChange={(e) => setEditForm({ ...editForm, greeting_message: e.target.value })} placeholder="Welcome message..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">System Prompt</label>
                    <textarea className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 h-32 resize-none" value={form.system_prompt || ''} onChange={(e) => setEditForm({ ...editForm, system_prompt: e.target.value })} placeholder="Instructions for AI agent..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">AI Model</label>
                      <select className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.ai_model || ''} onChange={(e) => setEditForm({ ...editForm, ai_model: e.target.value })}>
                        <option value="deepseek/deepseek-chat-v3-0615">Deepseek Chat</option>
                        <option value="openai/gpt-4o">GPT-4o</option>
                        <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                        <option value="google/gemini-pro">Gemini Pro</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Voice</label>
                      <select className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.voice || ''} onChange={(e) => setEditForm({ ...editForm, voice: e.target.value })}>
                        <option value="default">Default (Exotel Say)</option>
                        <option value="rachel">Rachel (ElevenLabs)</option>
                        <option value="domi">Domi (ElevenLabs)</option>
                        <option value="bella">Bella (ElevenLabs)</option>
                        <option value="elli">Elli (ElevenLabs)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Temperature ({form.temperature || 70}%)</label>
                      <input type="range" min="0" max="100" className="w-full accent-blue-600" value={form.temperature || 70} onChange={(e) => setEditForm({ ...editForm, temperature: parseInt(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Max Tokens</label>
                      <input type="number" className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150" value={form.max_tokens || 300} onChange={(e) => setEditForm({ ...editForm, max_tokens: parseInt(e.target.value) })} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`active-${type}`} checked={Boolean(form.is_active)} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor={`active-${type}`} className="text-sm text-gray-700">Active</label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveAgent} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5 shadow-sm">
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                    <button onClick={() => setEditing(null)} className="px-4 py-2 bg-white text-gray-700 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 inline-flex items-center gap-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Greeting</span>
                    <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{form.greeting_message || 'Default'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Model</span>
                    <p className="text-sm text-gray-700 mt-0.5">{form.ai_model || 'Deepseek Chat'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Voice</span>
                    <p className="text-sm text-gray-700 mt-0.5 capitalize">{form.voice || 'Default'}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Temperature</span>
                    <p className="text-sm text-gray-700 mt-0.5">{form.temperature || 70}%</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

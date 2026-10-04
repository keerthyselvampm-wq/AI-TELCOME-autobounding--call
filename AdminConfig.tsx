import { useState } from 'react'
import { Bot, FileText, BookOpen, HelpCircle, Layers, Brain, Clock, ClipboardList, ChevronRight } from 'lucide-react'
import AgentConfigView from './admin/AgentConfigView'
import DomainManager from './admin/DomainManager'
import KnowledgeManager from './admin/KnowledgeManager'
import PromptManager from './admin/PromptManager'
import AvailabilitySettings from './admin/AvailabilitySettings'
import FaqManager from './admin/FaqManager'
import AuditLogViewer from './admin/AuditLogViewer'
import AITrainingManager from './admin/AITrainingManager'

interface TabItem {
  id: string
  label: string
  icon: any
}

const groups: { label: string; tabs: TabItem[] }[] = [
  {
    label: 'AI Configuration',
    tabs: [
      { id: 'agents', label: 'Agent Config', icon: Bot },
      { id: 'prompts', label: 'Prompts', icon: FileText },
    ],
  },
  {
    label: 'Content',
    tabs: [
      { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
      { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    ],
  },
  {
    label: 'Internship',
    tabs: [
      { id: 'domains', label: 'Internship Programs', icon: Layers },
      { id: 'training', label: 'AI Training', icon: Brain },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      { id: 'availability', label: 'Availability', icon: Clock },
      { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
    ],
  },
]

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState('agents')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const activeGroup = groups.find((g) => g.tabs.some((t) => t.id === activeTab))
  const activeLabel = activeGroup?.tabs.find((t) => t.id === activeTab)?.label || ''

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-56' : 'w-0'} shrink-0 transition-all duration-200 hidden lg:block`}>
        <nav className="space-y-6 sticky top-6">
          {groups.map((group) => (
            <div key={group.label}>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">{group.label}</h4>
              <div className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <tab.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                      <span className="truncate">{tab.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-primary-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden w-full">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Admin Configuration</h2>
          <p className="text-gray-500 mt-1">Manage AI agents, content, internship programs, and operations</p>
        </div>
        <div className="border-b border-gray-200 mb-4 overflow-x-auto">
          <nav className="flex space-x-1">
            {groups.flatMap((g) => g.tabs).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="hidden lg:block mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{activeLabel}</h2>
          <p className="text-gray-500 mt-1">
            {activeTab === 'agents' && 'Configure AI agent behavior, model, voice, and system prompts'}
            {activeTab === 'prompts' && 'Manage prompt templates used by AI agents for various scenarios'}
            {activeTab === 'knowledge' && 'Build and maintain the knowledge base that powers AI responses'}
            {activeTab === 'faqs' && 'Manage frequently asked questions and their answers for AI matching'}
            {activeTab === 'domains' && 'Define internship domains, programs, and available batches'}
            {activeTab === 'training' && 'Add structured training content that teaches the AI about internship details'}
            {activeTab === 'availability' && 'Configure business hours and holiday schedules'}
            {activeTab === 'audit' && 'View audit trail of all admin configuration changes'}
          </p>
        </div>

        {activeTab === 'agents' && <AgentConfigView />}
        {activeTab === 'prompts' && <PromptManager />}
        {activeTab === 'knowledge' && <KnowledgeManager />}
        {activeTab === 'faqs' && <FaqManager />}
        {activeTab === 'domains' && <DomainManager />}
        {activeTab === 'training' && <AITrainingManager />}
        {activeTab === 'availability' && <AvailabilitySettings />}
        {activeTab === 'audit' && <AuditLogViewer />}
      </div>
    </div>
  )
}

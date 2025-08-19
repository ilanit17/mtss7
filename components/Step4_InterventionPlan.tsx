import React, { useState, useCallback, useEffect } from 'react';
import type { AnalysisData, FinalIssue, InterventionPlan, SupportPlan, SupportPlanAction, SupportPlanPartner, SupportPlanResource, SupportPlanTask } from '../types';
import { ACTION_CATEGORIES, PARTNER_CATEGORIES, RESOURCE_CATEGORIES, TASK_STATUSES, TIER_OPTIONS, TARGET_AUDIENCE_OPTIONS, FREQUENCY_OPTIONS, SUGGESTED_ACTIONS_BANK, SUGGESTED_PARTNERS_BANK, SUGGESTED_RESOURCES_BANK, ROUTINE_TASKS_BANK } from '../constants';
import { generatePlanSuggestions } from '../services/geminiService';

interface Step4Props {
  analysisData: AnalysisData;
  finalIssue: FinalIssue;
  onPlanComplete: (interventionPlan: InterventionPlan, supportPlan: SupportPlan) => void;
  onReset: () => void;
}

const WIZARD_STEPS = [
  "הגדרת מטרות ויעדים",
  "תכנון התערבות MTSS",
  "סיכום תוכנית ההתערבות",
  "בחירת פעולות ליבה לליווי",
  "זיהוי שותפים ומשאבים",
  "בניית תוכנית עבודה אופרטיבית",
  "סיכום והפקת דוח",
];

const GanttChart: React.FC<{ tasks: SupportPlanTask[] }> = ({ tasks }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validTasks = tasks.filter(t => t.startDate && t.endDate);
    if (validTasks.length === 0) {
        return <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">אין משימות עם תאריכים להצגה בלוח הגאנט.</div>;
    }
    
    const allDates = validTasks.flatMap(t => [new Date(t.startDate), new Date(t.endDate)]);
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    minDate.setDate(minDate.getDate() - 2);
    maxDate.setDate(maxDate.getDate() + 2);

    const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

    const months = [];
    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
        const monthName = currentDate.toLocaleString('he-IL', { month: 'long' });
        const year = currentDate.getFullYear();
        const monthKey = `${monthName} ${year}`;
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), daysInMonth);
        
        const startDay = Math.max(getDayOffset(startOfMonth), 0);
        const endDay = Math.min(getDayOffset(endOfMonth), totalDays);
        const monthDuration = endDay - startDay + 1;

        if (monthDuration > 0) {
           months.push({ name: monthKey, duration: monthDuration });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
    }

    function getDayOffset(date: Date) {
        return Math.floor((date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    const statusColors: Record<string, string> = {
        'טרם החל': 'bg-gray-400',
        'בתהליך': 'bg-blue-500',
        'הושלם': 'bg-green-500',
        'בסיכון': 'bg-red-500',
    };

    return (
         <div className="w-full overflow-x-auto bg-white p-4 rounded-lg border">
            <div className="grid" style={{ gridTemplateColumns: `200px repeat(${totalDays}, minmax(20px, 1fr))`, minWidth: '1000px' }}>
                {/* Header */}
                <div className="sticky right-0 bg-gray-100 border-b border-l p-2 font-semibold z-10">משימה</div>
                {months.map((month, index) => (
                    <div key={index} className="text-center border-b border-l p-2 font-semibold" style={{ gridColumn: `span ${month.duration}` }}>
                        {month.name}
                    </div>
                ))}

                {/* Rows */}
                {validTasks.map((task) => {
                    const startOffset = getDayOffset(new Date(task.startDate));
                    const duration = Math.max(1, getDayOffset(new Date(task.endDate)) - startOffset + 1);
                    
                    return (
                        <React.Fragment key={task.id}>
                            <div className="sticky right-0 bg-white border-b border-l p-2 text-sm truncate z-10" title={task.task}>{task.task}</div>
                            <div className="col-span-full border-b border-l grid" style={{ gridColumn: `2 / span ${totalDays}`, gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
                                <div
                                    className={`h-6 rounded my-1 text-white text-xs flex items-center justify-center ${statusColors[task.status] || 'bg-gray-400'}`}
                                    style={{ gridColumn: `${startOffset + 1} / span ${duration}` }}
                                    title={`${task.task} (${task.status})`}
                                >
                                    <span className="truncate px-1">{task.task}</span>
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                 {/* Today Line */}
                <div style={{ gridRow: `1 / span ${validTasks.length + 2}`, gridColumn: getDayOffset(today) + 2 }} className="w-0.5 h-full bg-red-500 opacity-70 relative">
                    <div className="absolute -top-5 -translate-x-1/2 text-red-500 text-xs font-bold">היום</div>
                </div>
            </div>
        </div>
    );
};

const TaskBankModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAddTasks: (tasks: string[]) => void;
}> = ({ isOpen, onClose, onAddTasks }) => {
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    
    if (!isOpen) return null;

    const toggleTask = (task: string) => {
        setSelectedTasks(prev => 
            prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task]
        );
    };

    const handleAdd = () => {
        onAddTasks(selectedTasks);
        setSelectedTasks([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">הוספת משימות שוטפות מהמאגר</h3>
                    <p className="text-sm text-gray-600">בחר משימות להוסיף לתוכנית העבודה האופרטיבית שלך.</p>
                </div>
                <div className="p-4 overflow-y-auto space-y-4">
                    {ROUTINE_TASKS_BANK.map(category => (
                        <div key={category.category}>
                            <h4 className="font-semibold text-blue-700 bg-blue-100 p-2 rounded-md">{category.category}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                {category.tasks.map(task => (
                                    <label key={task} className="flex items-center space-x-2 rtl:space-x-reverse p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedTasks.includes(task)}
                                            onChange={() => toggleTask(task)}
                                            className="form-checkbox h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{task}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                     <span className="text-sm font-semibold text-gray-700">נבחרו {selectedTasks.length} משימות</span>
                    <div>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 mr-2">ביטול</button>
                        <button onClick={handleAdd} disabled={selectedTasks.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400">הוסף משימות</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Step4_InterventionPlan: React.FC<Step4Props> = ({ analysisData, finalIssue, onPlanComplete, onReset }) => {
  const [wizardStep, setWizardStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isTaskBankOpen, setIsTaskBankOpen] = useState(false);
  
  const [interventionPlan, setInterventionPlan] = useState<InterventionPlan>({
    mainGoal: '', smartObjectives: [''], tier1: { outcomes: [''] }, tier2Groups: [], tier3: { outcomes: [''] },
  });
  
  const [supportPlan, setSupportPlan] = useState<SupportPlan>({
    coreActions: [], partners: [], resources: [], operationalPlan: [],
  });
  
  useEffect(() => {
    setLoading(true);
    generatePlanSuggestions(finalIssue).then(suggestions => {
      if(suggestions.mainGoal && suggestions.smartObjectives.length > 0) {
        setInterventionPlan(prev => ({...prev, mainGoal: suggestions.mainGoal, smartObjectives: suggestions.smartObjectives}));
      }
      setLoading(false);
    }).catch(err => {
        console.error("Failed to get plan suggestions:", err);
        setLoading(false);
    })
  }, [finalIssue]);

  const handleNext = () => setWizardStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  const handleBack = () => setWizardStep(prev => Math.max(prev - 1, 0));

  const handleInterventionChange = <T extends keyof InterventionPlan>(field: T, value: InterventionPlan[T]) => {
    setInterventionPlan(prev => ({...prev, [field]: value}));
  };
  
  const handleSupportChange = <T extends keyof SupportPlan>(field: T, value: SupportPlan[T]) => {
    setSupportPlan(prev => ({...prev, [field]: value}));
  };
  
  // Handlers for dynamic lists
  const addTier2Group = () => handleInterventionChange('tier2Groups', [...interventionPlan.tier2Groups, {id: Date.now().toString(), name: `קבוצת שכבה 2 ${interventionPlan.tier2Groups.length + 1}`, outcomes:[], schools:[]}]);
  const updateTier2Group = (id: string, field: string, value: any) => handleInterventionChange('tier2Groups', interventionPlan.tier2Groups.map(g => g.id === id ? {...g, [field]:value} : g));
  const removeTier2Group = (id: string) => handleInterventionChange('tier2Groups', interventionPlan.tier2Groups.filter(g => g.id !== id));

  const addAction = (action?: Partial<SupportPlanAction>) => handleSupportChange('coreActions', [...supportPlan.coreActions, { id: Date.now().toString(), name: '', description: '', category: ACTION_CATEGORIES[0], tier: TIER_OPTIONS[0], targetAudience: TARGET_AUDIENCE_OPTIONS[0], frequency: FREQUENCY_OPTIONS[0], ...action }]);
  const updateAction = (id: string, field: string, value: any) => handleSupportChange('coreActions', supportPlan.coreActions.map(a => a.id === id ? {...a, [field]:value} : a));
  const removeAction = (id: string) => handleSupportChange('coreActions', supportPlan.coreActions.filter(a => a.id !== id));

  const addPartner = (partner?: Partial<SupportPlanPartner>) => handleSupportChange('partners', [...supportPlan.partners, { id: Date.now().toString(), name: '', category: PARTNER_CATEGORIES[0], role: '', ...partner }]);
  const updatePartner = (id: string, field: string, value: any) => handleSupportChange('partners', supportPlan.partners.map(p => p.id === id ? {...p, [field]:value} : p));
  const removePartner = (id: string) => handleSupportChange('partners', supportPlan.partners.filter(p => p.id !== id));

  const addResource = (resource?: Partial<SupportPlanResource>) => handleSupportChange('resources', [...supportPlan.resources, { id: Date.now().toString(), name: '', category: RESOURCE_CATEGORIES[0], details: '', ...resource }]);
  const updateResource = (id: string, field: string, value: any) => handleSupportChange('resources', supportPlan.resources.map(r => r.id === id ? {...r, [field]:value} : r));
  const removeResource = (id: string) => handleSupportChange('resources', supportPlan.resources.filter(r => r.id !== id));

  const addTask = () => handleSupportChange('operationalPlan', [...supportPlan.operationalPlan, { id: Date.now().toString(), task: '', responsible: '', startDate: '', endDate: '', status: TASK_STATUSES[0], actionId: '' }]);
  const updateTask = (id: string, field: string, value: any) => handleSupportChange('operationalPlan', supportPlan.operationalPlan.map(t => t.id === id ? {...t, [field]:value} : t));
  const removeTask = (id: string) => handleSupportChange('operationalPlan', supportPlan.operationalPlan.filter(t => t.id !== id));
  
  const addTasksFromBank = (tasks: string[]) => {
      const newTasks: SupportPlanTask[] = tasks.map(taskStr => ({
        id: `${Date.now()}-${Math.random()}`,
        task: taskStr,
        responsible: 'המפקח/ת',
        startDate: '',
        endDate: '',
        status: TASK_STATUSES[0],
        actionId: '', 
      }));
      handleSupportChange('operationalPlan', [...supportPlan.operationalPlan, ...newTasks]);
  };


  const downloadFullReport = () => {
     const ganttHTML = document.getElementById('gantt-container-for-report')?.innerHTML || 'לוח גאנט לא זמין';
     const reportCss = `
        body { font-family: system-ui, sans-serif; direction: rtl; }
        .container { max-width: 1200px; margin: auto; padding: 2rem; }
        .section { margin-bottom: 2rem; padding: 1.5rem; border-radius: 0.5rem; background-color: #f9fafb; border: 1px solid #e5e7eb; }
        h1, h2, h3, h4 { color: #111827; font-weight: bold; }
        h1 { font-size: 2.25rem; text-align: center; margin-bottom: 2rem; color: #047857; }
        h2 { font-size: 1.875rem; border-bottom: 2px solid #059669; padding-bottom: 0.5rem; margin-bottom: 1rem; }
        h3 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #065f46; }
        h4 { font-size: 1.25rem; margin-bottom: 0.5rem; }
        p, li { color: #374151; line-height: 1.6; }
        ul { list-style-type: disc; padding-right: 2rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { border: 1px solid #d1d5db; padding: 0.75rem; text-align: right; }
        th { background-color: #f3f4f6; }
        .gantt-container { overflow-x: auto; }
     `;

    const reportHTML = `
        <!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>דוח תוכנית התערבות וליווי</title>
        <style>${reportCss}</style></head><body><div class="container">
            <h1>תוכנית התערבות וליווי</h1>
            <div class="section"><h2>הסוגייה המרכזית</h2>
                <p><strong>כיצד ניתן ל${finalIssue.action} את ${finalIssue.subject} ב${finalIssue.context}, על מנת ל${finalIssue.result}?</strong></p>
                <h4>חזון אסטרטגי:</h4><p>${finalIssue.vision}</p>
            </div>
            <div class="section"><h2>תוכנית התערבות MTSS</h2>
                <h3>מטרה מרכזית:</h3><p>${interventionPlan.mainGoal}</p>
                <h3>יעדים (SMART):</h3><ul>${interventionPlan.smartObjectives.map(o => `<li>${o}</li>`).join('')}</ul>
                <h4>שכבה 1:</h4><ul>${interventionPlan.tier1.outcomes.map(o => `<li>${o}</li>`).join('')}</ul>
                <h4>שכבה 3:</h4><ul>${interventionPlan.tier3.outcomes.map(o => `<li>${o}</li>`).join('')}</ul>
            </div>
            <div class="section"><h2>תוכנית ליווי</h2>
                 <h3>פעולות ליבה:</h3>
                <table><thead><tr><th>פעולה</th><th>תיאור</th><th>קטגוריה</th></tr></thead><tbody>
                ${supportPlan.coreActions.map(a => `<tr><td>${a.name}</td><td>${a.description}</td><td>${a.category}</td></tr>`).join('')}
                </tbody></table>
                 <h3>שותפים:</h3>
                <table><thead><tr><th>שם</th><th>תפקיד</th><th>קטגוריה</th></tr></thead><tbody>
                ${supportPlan.partners.map(p => `<tr><td>${p.name}</td><td>${p.role}</td><td>${p.category}</td></tr>`).join('')}
                </tbody></table>
                 <h3>משאבים:</h3>
                <table><thead><tr><th>שם</th><th>פירוט</th><th>קטגוריה</th></tr></thead><tbody>
                ${supportPlan.resources.map(r => `<tr><td>${r.name}</td><td>${r.details}</td><td>${r.category}</td></tr>`).join('')}
                </tbody></table>
            </div>
            <div class="section"><h2>תוכנית אופרטיבית - לוח גאנט</h2><div class="gantt-container">${ganttHTML}</div></div>
        </div></body></html>
    `;

    const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'MTSS_Plan_Report.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const renderContent = () => {
    switch (wizardStep) {
        case 0: // Goals
            return (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold">הגדרת מטרות ויעדים</h3>
                    {loading ? <p>טוען הצעות AI...</p> : <>
                    <div>
                        <label className="font-semibold">מטרה מרכזית</label>
                        <textarea value={interventionPlan.mainGoal} onChange={e => handleInterventionChange('mainGoal', e.target.value)} rows={3} className="w-full p-2 border rounded mt-1"/>
                    </div>
                     <div>
                        <label className="font-semibold">יעדים תפעוליים (SMART)</label>
                        <textarea value={interventionPlan.smartObjectives.join('\n')} onChange={e => handleInterventionChange('smartObjectives', e.target.value.split('\n'))} rows={4} className="w-full p-2 border rounded mt-1"/>
                    </div></>}
                </div>
            );
        case 1: // MTSS Plan
            return (
                <div className="space-y-6">
                     <h3 className="text-xl font-bold">תכנון התערבות MTSS</h3>
                     <div className="p-4 bg-green-50 border-r-4 border-green-500 rounded">
                         <h4 className="font-bold text-green-700">שכבה 1: אוניברסלי</h4>
                         <textarea value={interventionPlan.tier1.outcomes.join('\n')} onChange={e => handleInterventionChange('tier1', {outcomes: e.target.value.split('\n')})} placeholder="תוצרים ופעולות לכלל בתי הספר" rows={3} className="w-full p-2 border rounded mt-1"/>
                     </div>
                      <div className="p-4 bg-yellow-50 border-r-4 border-yellow-500 rounded">
                         <h4 className="font-bold text-yellow-700">שכבה 2: קבוצתית</h4>
                         {interventionPlan.tier2Groups.map(group => (
                             <div key={group.id} className="p-3 my-2 bg-white border rounded space-y-2">
                                 <input value={group.name} onChange={e => updateTier2Group(group.id, 'name', e.target.value)} placeholder="שם הקבוצה" className="font-semibold w-full p-1 border-b"/>
                                 <textarea value={group.outcomes.join('\n')} onChange={e => updateTier2Group(group.id, 'outcomes', e.target.value.split('\n'))} rows={2} placeholder="תוצרים לקבוצה" className="w-full p-2 border rounded"/>
                                 <button onClick={() => removeTier2Group(group.id)} className="text-red-500 text-xs mt-1 hover:underline">הסר קבוצה</button>
                             </div>
                         ))}
                         <button onClick={addTier2Group} className="mt-2 bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600">➕ הוסף קבוצת שכבה 2</button>
                     </div>
                      <div className="p-4 bg-red-50 border-r-4 border-red-500 rounded">
                         <h4 className="font-bold text-red-700">שכבה 3: אינטנסיבית</h4>
                         <textarea value={interventionPlan.tier3.outcomes.join('\n')} onChange={e => handleInterventionChange('tier3', {outcomes: e.target.value.split('\n')})} placeholder="תוצרים לבתי ספר בתמיכה אינטנסיבית" rows={3} className="w-full p-2 border rounded mt-1"/>
                     </div>
                </div>
            );
        case 2: // Intervention Summary
            return (
                <div>
                     <h3 className="text-xl font-bold mb-4">סיכום תוכנית ההתערבות</h3>
                     <div className="p-4 bg-gray-50 rounded prose max-w-full">
                         <h4>מטרה מרכזית:</h4>
                         <p className="p-2 bg-white rounded border">{interventionPlan.mainGoal}</p>
                         <h4>יעדים:</h4>
                         <ul className="list-disc list-inside space-y-1">{interventionPlan.smartObjectives.filter(o => o.trim()).map((o,i) => <li key={i}>{o}</li>)}</ul>
                     </div>
                </div>
            );
        case 3: // Core Actions
             return (
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-xl font-bold">פעולות ליבה לליווי</h3>
                        {supportPlan.coreActions.map((action) => (
                            <div key={action.id} className="bg-white p-4 border rounded shadow-sm space-y-2">
                                <input value={action.name} onChange={e => updateAction(action.id, 'name', e.target.value)} placeholder="שם הפעולה" className="text-lg font-semibold w-full border-b mb-2 p-1" />
                                <textarea value={action.description} onChange={e => updateAction(action.id, 'description', e.target.value)} placeholder="תיאור הפעולה" rows={2} className="w-full p-2 border rounded" />
                                <button onClick={() => removeAction(action.id)} className="text-red-500 text-xs hover:underline">הסר פעולה</button>
                            </div>
                        ))}
                         <button onClick={() => addAction()} className="mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">➕ הוסף פעולה</button>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
                        <h4 className="font-semibold mb-2">מאגר הצעות</h4>
                        {SUGGESTED_ACTIONS_BANK.map((sugg, i) => (
                             <div key={i} className="p-2 border-b hover:bg-gray-100">
                                <p className="font-semibold text-sm">{sugg.name}</p>
                                <button onClick={() => addAction(sugg)} className="text-blue-500 text-xs hover:underline">הוסף</button>
                            </div>
                        ))}
                    </div>
                </div>
             );
        case 4: // Partners & Resources
            return (
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Partners */}
                    <div className="space-y-4">
                         <h3 className="text-xl font-bold">זיהוי שותפים</h3>
                         <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                            {supportPlan.partners.map(p => (
                                <div key={p.id} className="bg-white p-3 border rounded shadow-sm">
                                    <input value={p.name} onChange={e => updatePartner(p.id, 'name', e.target.value)} placeholder="שם השותף" className="font-semibold w-full border-b p-1 mb-2"/>
                                    <input value={p.role} onChange={e => updatePartner(p.id, 'role', e.target.value)} placeholder="תפקיד" className="w-full p-1 border rounded text-sm"/>
                                    <button onClick={() => removePartner(p.id)} className="text-red-500 text-xs mt-1 hover:underline">הסר</button>
                                </div>
                            ))}
                         </div>
                         <button onClick={() => addPartner()} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">➕ הוסף שותף</button>
                         <div className="bg-gray-50 p-2 rounded border max-h-60 overflow-y-auto"><h4 className="text-sm font-semibold mb-1">הצעות</h4>{SUGGESTED_PARTNERS_BANK.map((s, i) => <div key={i} className="p-1 border-b text-xs"><p>{s.name}</p><button onClick={() => addPartner(s)} className="text-blue-500">הוסף</button></div>)}</div>
                    </div>
                    {/* Resources */}
                    <div className="space-y-4">
                         <h3 className="text-xl font-bold">זיהוי משאבים</h3>
                         <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                             {supportPlan.resources.map(r => (
                                <div key={r.id} className="bg-white p-3 border rounded shadow-sm">
                                    <input value={r.name} onChange={e => updateResource(r.id, 'name', e.target.value)} placeholder="שם המשאב" className="font-semibold w-full border-b p-1 mb-2"/>
                                    <input value={r.details} onChange={e => updateResource(r.id, 'details', e.target.value)} placeholder="פרטים" className="w-full p-1 border rounded text-sm"/>
                                    <button onClick={() => removeResource(r.id)} className="text-red-500 text-xs mt-1 hover:underline">הסר</button>
                                </div>
                             ))}
                         </div>
                          <button onClick={() => addResource()} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">➕ הוסף משאב</button>
                         <div className="bg-gray-50 p-2 rounded border max-h-60 overflow-y-auto"><h4 className="text-sm font-semibold mb-1">הצעות</h4>{SUGGESTED_RESOURCES_BANK.map((s, i) => <div key={i} className="p-1 border-b text-xs"><p>{s.name}</p><button onClick={() => addResource(s)} className="text-blue-500">הוסף</button></div>)}</div>
                    </div>
                </div>
            );
        case 5: // Operational Plan
             return (
                 <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold">בניית תוכנית עבודה אופרטיבית</h3>
                        <div className="flex gap-2">
                            <button onClick={addTask} className="bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 text-sm">➕ הוסף משימה</button>
                             <button onClick={() => setIsTaskBankOpen(true)} className="bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 text-sm">🗂️ הוסף משימה שוטפת מהמאגר</button>
                        </div>
                     </div>
                     <div className="overflow-x-auto border rounded-lg">
                         <table className="min-w-full bg-white text-sm">
                             <thead className="bg-gray-100">
                                 <tr>
                                     <th className="p-2 text-right">משימה</th><th className="p-2 text-right">אחראי</th>
                                     <th className="p-2 text-right">פעולת ליבה</th><th className="p-2 text-right">התחלה</th>
                                     <th className="p-2 text-right">סיום</th><th className="p-2 text-right">סטטוס</th>
                                     <th className="p-2"></th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {supportPlan.operationalPlan.map(task => (
                                     <tr key={task.id} className="border-b">
                                         <td className="p-1"><input type="text" value={task.task} onChange={e => updateTask(task.id, 'task', e.target.value)} className="w-full p-1 border rounded"/></td>
                                         <td className="p-1"><input type="text" value={task.responsible} onChange={e => updateTask(task.id, 'responsible', e.target.value)} className="w-full p-1 border rounded"/></td>
                                         <td className="p-1">
                                             <select value={task.actionId} onChange={e => updateTask(task.id, 'actionId', e.target.value)} className="w-full p-1 border rounded bg-white">
                                                <option value="">בחר פעולה</option>
                                                {supportPlan.coreActions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                             </select>
                                         </td>
                                         <td className="p-1"><input type="date" value={task.startDate} onChange={e => updateTask(task.id, 'startDate', e.target.value)} className="w-full p-1 border rounded"/></td>
                                         <td className="p-1"><input type="date" value={task.endDate} onChange={e => updateTask(task.id, 'endDate', e.target.value)} className="w-full p-1 border rounded"/></td>
                                         <td className="p-1">
                                            <select value={task.status} onChange={e => updateTask(task.id, 'status', e.target.value)} className="w-full p-1 border rounded bg-white">
                                                {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                         </td>
                                         <td className="p-1 text-center"><button onClick={() => removeTask(task.id)} className="text-red-500">🗑️</button></td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             );
        case 6: // Final Report
            return (
                <div className="text-center space-y-6">
                    <h3 className="text-2xl font-bold text-teal-700">✅ כל השלבים הושלמו!</h3>
                    <p className="text-lg text-gray-600">התוכנית המלאה מוכנה להורדה. להלן תצוגה מקדימה של לוח הגאנט:</p>
                    <div id="gantt-container-for-report">
                        <GanttChart tasks={supportPlan.operationalPlan} />
                    </div>
                    <div className="pt-4 space-x-4 rtl:space-x-reverse">
                         <button onClick={downloadFullReport} className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-xl hover:bg-blue-700 transition transform hover:scale-105">
                            📄 הורד דוח מסכם ומלא
                        </button>
                    </div>
                </div>
            );
        default: return <div className="p-4 bg-gray-100 rounded-md">בבנייה... שלב {wizardStep + 1}</div>;
    }
  };

  return (
      <div className="space-y-6">
           <TaskBankModal isOpen={isTaskBankOpen} onClose={() => setIsTaskBankOpen(false)} onAddTasks={addTasksFromBank} />
          <div className="flex items-center space-x-4 rtl:space-x-reverse overflow-x-auto pb-2">
              {WIZARD_STEPS.map((step, index) => (
                  <div key={index} className={`flex items-center space-x-2 rtl:space-x-reverse flex-shrink-0 ${index > 0 ? 'before:content-[""] before:w-8 before:h-0.5 before:bg-gray-300' : ''}`}>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${wizardStep >= index ? 'bg-teal-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
                          {wizardStep > index ? '✓' : index + 1}
                       </div>
                       <span className={`font-semibold transition-colors ${wizardStep >= index ? 'text-teal-700' : 'text-gray-500'}`}>{step}</span>
                  </div>
              ))}
          </div>
          <div className="p-6 bg-white rounded-lg shadow-inner border min-h-[450px]">
              {renderContent()}
          </div>
          <div className="flex justify-between items-center">
              <div>
                  {wizardStep > 0 && wizardStep < WIZARD_STEPS.length - 1 && <button onClick={handleBack} className="px-6 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700">חזור</button>}
              </div>
              <div>
                  {wizardStep < WIZARD_STEPS.length - 1 ? (
                     <button onClick={handleNext} className="px-6 py-2 bg-teal-600 text-white rounded-lg shadow hover:bg-teal-700">המשך</button>
                  ) : (
                     <button onClick={onReset} className="px-6 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700">התחל מחדש</button>
                  )}
              </div>
          </div>
      </div>
  );
};

export default Step4_InterventionPlan;
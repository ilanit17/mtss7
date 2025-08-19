import React, { useState, useCallback } from 'react';
import type { School, Score, ChallengeCategory } from '../types';
import { CHALLENGES, NEW_CHALLENGE_CATEGORIES, allSubCategories } from '../constants';

// Props for ChallengeSelector
interface ChallengeSelectorProps {
  category: ChallengeCategory;
  school: School;
  onChallengeChange: (schoolId: number, category: ChallengeCategory, challengeIndex: number, checked: boolean) => void;
}

const ChallengeSelector: React.FC<ChallengeSelectorProps> = ({ category, school, onChallengeChange }) => {
  const categoryChallenges = CHALLENGES[category] || [];
  const selectedChallenges = school[`${category}Challenges`] || [];

  return (
    <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-md max-h-48 overflow-y-auto">
      <div className="text-xs font-bold text-gray-600 mb-1">🎯 אתגרים מקצועיים ({selectedChallenges.length})</div>
      {categoryChallenges.map((challenge, index) => (
        <label key={index} className="flex items-center text-xs text-gray-700 space-x-2 rtl:space-x-reverse mb-1 hover:bg-gray-100 p-1 rounded">
          <input
            type="checkbox"
            className="form-checkbox h-3 w-3 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            checked={selectedChallenges.includes(index)}
            onChange={(e) => onChallengeChange(school.id, category, index, e.target.checked)}
          />
          <span>{challenge}</span>
        </label>
      ))}
    </div>
  );
};

// Props for SchoolRow
interface SchoolRowProps {
  school: School;
  onUpdate: (id: number, field: keyof School, value: any) => void;
  onRemove: (id: number) => void;
}

const SchoolRow: React.FC<SchoolRowProps> = React.memo(({ school, onUpdate, onRemove }) => {
    const handleChallengeChange = useCallback((schoolId: number, category: ChallengeCategory, challengeIndex: number, checked: boolean) => {
        const currentChallenges = school[`${category}Challenges`] || [];
        let newChallenges;
        if (checked) {
            newChallenges = [...currentChallenges, challengeIndex];
        } else {
            newChallenges = currentChallenges.filter(c => c !== challengeIndex);
        }
        onUpdate(schoolId, `${category}Challenges` as keyof School, newChallenges);
    }, [school, onUpdate]);

    return (
        <tr className="bg-white hover:bg-gray-50">
            <td className="p-2 border-b border-r border-gray-200 text-right font-semibold bg-gray-50 sticky right-0 z-10 align-top">
                <input
                    type="text"
                    value={school.name}
                    onChange={(e) => onUpdate(school.id, 'name', e.target.value)}
                    placeholder="שם בית הספר"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
            </td>
            <td className="p-2 border-b border-r border-gray-200 align-top">
                <input
                    type="text"
                    value={school.principal}
                    onChange={(e) => onUpdate(school.id, 'principal', e.target.value)}
                    placeholder="שם המנהל/ת"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
            </td>
            <td className="p-2 border-b border-r border-gray-200 align-top">
                <input
                    type="number"
                    value={school.students}
                    onChange={(e) => onUpdate(school.id, 'students', e.target.value)}
                    placeholder="מספר"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                />
            </td>
            {allSubCategories.map(subCat => {
                const scoreField = `${subCat.key}Score` as keyof School;
                return (
                    <td key={subCat.key} className="p-2 border-b border-r border-gray-200 align-top min-w-[200px]">
                        <select 
                            value={school[scoreField] as Score} 
                            onChange={(e) => onUpdate(school.id, scoreField, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm bg-white"
                        >
                            <option value="">בחר רמה</option>
                            <option value="1">1 - נמוכה מאוד</option>
                            <option value="2">2 - נמוכה</option>
                            <option value="3">3 - בינונית</option>
                            <option value="4">4 - גבוהה</option>
                            <option value="5">5 - גבוהה מאוד</option>
                        </select>
                        <ChallengeSelector category={subCat.key} school={school} onChallengeChange={handleChallengeChange} />
                    </td>
                );
            })}
            <td className="p-2 border-b border-r border-gray-200 align-top">
                <textarea
                    rows={2}
                    value={school.notes}
                    onChange={(e) => onUpdate(school.id, 'notes', e.target.value)}
                    placeholder="הערות ופעולות מתוככנות"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm min-h-[120px]"
                ></textarea>
            </td>
            <td className="p-2 border-b border-gray-200 align-top text-center">
                <button onClick={() => onRemove(school.id)} className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600 transition-colors text-sm">
                    🗑️ מחק
                </button>
            </td>
        </tr>
    );
});

// Main Component for Step 1
interface Step1Props {
  schools: School[];
  setSchools: React.Dispatch<React.SetStateAction<School[]>>;
  onComplete: () => void;
}

const Step1_MappingTable: React.FC<Step1Props> = ({ schools, setSchools, onComplete }) => {
    const [inspectorName, setInspectorName] = useState('יעל נתן');
    const [nextId, setNextId] = useState(1);

    const addSchool = useCallback(() => {
        const initialFields = allSubCategories.reduce((acc, sub) => {
            acc[`${sub.key}Score`] = '';
            acc[`${sub.key}Challenges`] = [];
            return acc;
        }, {} as any);

        const newSchool: School = {
            id: nextId, 
            name: '', 
            principal: '', 
            students: '', 
            notes: '',
            ...initialFields
        };
        setSchools(prev => [...prev, newSchool]);
        setNextId(prev => prev + 1);
    }, [nextId, setSchools]);

    const removeSchool = useCallback((id: number) => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק את בית הספר?')) {
            setSchools(prev => prev.filter(school => school.id !== id));
        }
    }, [setSchools]);

    const updateSchool = useCallback((id: number, field: keyof School, value: any) => {
        setSchools(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    }, [setSchools]);

    const clearAll = useCallback(() => {
        if (window.confirm('האם אתה בטוח שברצונך למחוק את כל הנתונים? פעולה זו אינה ניתנת לביטול.')) {
            setSchools([]);
            setNextId(1);
            alert('כל הנתונים נמחקו!');
        }
    }, [setSchools]);

    const exportData = useCallback(() => {
        let csvContent = '\uFEFF';
        const headers = [
            'מפקח/ת', 'שם בית הספר', 'מנהל/ת', 'מס\' תלמידים', 
            ...allSubCategories.map(c => c.name), 
            'הערות', 
            ...allSubCategories.map(c => `אתגרי ${c.name}`)
        ];
        csvContent += headers.map(h => `"${h}"`).join(',') + '\n';

        schools.forEach(school => {
            const challengesTexts = allSubCategories.map(cat => {
                const challengesForCat = school[`${cat.key}Challenges`] as number[] || [];
                return challengesForCat.map(i => CHALLENGES[cat.key][i]).filter(Boolean).join('; ');
            });
            const scores = allSubCategories.map(cat => school[`${cat.key}Score`]);

            const row = [
                inspectorName, school.name, school.principal, school.students,
                ...scores,
                school.notes,
                ...challengesTexts
            ].map(field => `"${String(field || '').replace(/"/g, '""')}"`);

            csvContent += row.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `מיפוי_בתי_ספר_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [schools, inspectorName]);
    
    return (
        <div>
            <div className="bg-white p-4 rounded-lg mb-6 shadow-md border border-gray-200">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-grow min-w-[250px]">
                        <label className="block text-sm font-medium text-gray-700 mb-1">שם המפקח/ת:</label>
                        <input
                            type="text"
                            value={inspectorName}
                            onChange={(e) => setInspectorName(e.target.value)}
                            placeholder="הכנס/י את שמך"
                            className="w-full p-2 border border-gray-300 rounded-lg shadow-sm"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-6">
                        <button onClick={addSchool} className="btn bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">➕ הוסף בית ספר</button>
                        <button onClick={exportData} className="btn bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">📊 ייצא נתונים</button>
                        <button onClick={clearAll} className="btn bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-transform transform hover:scale-105">🗑️ נקה הכל</button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-md">
                <table className="min-w-full bg-white text-sm" style={{minWidth: '4000px'}}>
                    <thead className="bg-gray-800 text-white">
                        <tr>
                            <th rowSpan={2} className="p-3 text-right sticky right-0 z-20 bg-gray-800 border-l border-gray-700 align-middle">שם בית הספר</th>
                            <th rowSpan={2} className="p-3 text-center border-l border-gray-700 align-middle">מנהל/ת</th>
                            <th rowSpan={2} className="p-3 text-center border-l border-gray-700 align-middle">מס' תלמידים</th>
                            {NEW_CHALLENGE_CATEGORIES.map(cat => (
                                <th key={cat.name} colSpan={cat.subCategories.length} className={`p-3 text-center border-l border-gray-700 ${cat.color}`}>
                                    {cat.name}
                                </th>
                            ))}
                            <th rowSpan={2} className="p-3 text-center border-l border-gray-700 align-middle min-w-[200px]">הערות / פעולות</th>
                            <th rowSpan={2} className="p-3 text-center align-middle">פעולות</th>
                        </tr>
                        <tr>
                           {NEW_CHALLENGE_CATEGORIES.flatMap(cat => cat.subCategories.map(subCat => (
                                <th key={subCat.key} className={`p-3 text-center border-l border-gray-700 ${cat.color} align-middle`}>
                                    {subCat.name}
                                </th>
                           )))}
                        </tr>
                    </thead>
                    <tbody>
                        {schools.length > 0 ? (
                            schools.map(school => (
                                <SchoolRow key={school.id} school={school} onUpdate={updateSchool} onRemove={removeSchool} />
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5 + allSubCategories.length} className="text-center p-12 text-gray-500">
                                    <h3 className="text-xl font-semibold">🏫 לא נוספו בתי ספר עדיין</h3>
                                    <p>לחץ על "הוסף בית ספר" כדי להתחיל</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 p-4 bg-gray-100 rounded-lg text-center shadow-inner">
                <h3 className="text-lg font-semibold text-gray-700">📈 סיכום המיפוי</h3>
                <div className="text-2xl font-bold text-gray-800 mt-1">
                    <strong>{schools.length}</strong> בתי ספר במיפוי
                </div>
            </div>

            <div className="mt-8 text-center">
                <button onClick={onComplete} disabled={schools.length === 0} className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white text-lg font-bold rounded-lg shadow-xl hover:from-green-600 hover:to-teal-700 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                    המשך לניתוח נתונים ←
                </button>
            </div>
        </div>
    );
};

export default Step1_MappingTable;
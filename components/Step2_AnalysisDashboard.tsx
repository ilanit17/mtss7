import React, { useState, useEffect, useMemo } from 'react';
import type { School, AnalysisData, Insight, SchoolForAnalysis, Score } from '../types';
import { ALL_FIELDS_FOR_HEATMAP, FIELD_HEBREW_MAP, NEW_CHALLENGE_CATEGORIES, CHALLENGES } from '../constants';
import { generateInsights } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Step2Props {
  schoolsData: School[];
  onAnalysisComplete: (data: AnalysisData) => void;
}

const COLORS = ['#e74c3c', '#f39c12', '#27ae60'];
const PIE_COLORS = ['#667eea', '#764ba2', '#8e44ad', '#9b59b6'];


const LoadingSpinner: React.FC = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-teal-500"></div>
    </div>
);

const MTSS_TIERS_INFO = {
    tier1: {
        title: "שכבה 1 - מענה אוניברסלי",
        description: "כלל בתי הספר הזוכים למענה אוניברסלי - פיתוח מקצועי, ליווי שוטף ותמיכה בסיסית.",
        style: "bg-green-50 border-green-500",
        titleStyle: "text-green-700",
        countStyle: "bg-green-600"
    },
    tier2: {
        title: "שכבה 2 - תמיכה ממוקדת",
        description: "בתי ספר עם אתגרים מתונים הזקוקים להתערבות ממוקדת נוסף על המענה האוניברסלי.",
        style: "bg-yellow-50 border-yellow-500",
        titleStyle: "text-yellow-700",
        countStyle: "bg-yellow-500"
    },
    tier3: {
        title: "שכבה 3 - התערבות אינטנסיבית",
        description: "בתי ספר בסיכון גבוה הזקוקים להתערבות מיידית ואינטנסיבית.",
        style: "bg-red-50 border-red-500",
        titleStyle: "text-red-700",
        countStyle: "bg-red-600"
    }
};

const TierDisplay: React.FC<{ tier: 'tier1' | 'tier2' | 'tier3', schools: SchoolForAnalysis[] }> = ({ tier, schools }) => {
    const [isOpen, setIsOpen] = useState(false);
    const info = MTSS_TIERS_INFO[tier];

    return (
         <div className={`${info.style} p-6 rounded-lg border-r-8 shadow`}>
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <h3 className={`text-xl font-bold ${info.titleStyle}`}>{info.title}</h3>
                <div className="flex items-center gap-4">
                    <span className={`${info.countStyle} text-white px-4 py-1 rounded-full font-bold`}>{schools.length}</span>
                    <span className="text-2xl text-gray-500 transform transition-transform" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                </div>
            </div>
            <p className="text-gray-600 mt-2">{info.description}</p>
            {isOpen && (
                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {schools.length > 0 ? schools.map(school => (
                        <div key={school.id} className="bg-white p-3 rounded-md shadow border">
                            <p className="font-bold text-gray-800">{school.name}</p>
                            <p className="text-sm text-gray-600">מנהל/ת: {school.principal || '-'}</p>
                            <p className="text-sm text-gray-600">תלמידים: {school.students || '-'}</p>
                        </div>
                    )) : <p className="text-gray-500 col-span-full">אין בתי ספר בשכבה זו.</p>}
                </div>
            )}
        </div>
    );
};


const AnalysisDashboard: React.FC<Step2Props> = ({ schoolsData, onAnalysisComplete }) => {
    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);

    const performAnalysis = useMemo(() => {
        return (data: School[]): AnalysisData => {
            const getCharacterization = (school: School): string => {
                const scores = ALL_FIELDS_FOR_HEATMAP.map(field => parseInt(school[field as keyof School] as string) || 0).filter(s => s > 0);
                if (scores.length === 0) return 'יציב';
                const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
                if (avgScore <= 2.5) return 'בסיכון גבוה';
                if (avgScore <= 3.5) return 'עם אתגרים מתונים';
                return 'יציב';
            };

            const getTier = (school: School): 1 | 2 | 3 => {
                 const scores = ALL_FIELDS_FOR_HEATMAP.map(s => parseInt(school[s as keyof School] as string) || 0).filter(s => s > 0);
                 const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
                 if (avg <= 2.5) return 3;
                 if (avg <= 3.5) return 2;
                 return 1;
            }

            const schoolsForAnalysis: SchoolForAnalysis[] = data.map(school => ({
                ...school,
                characterization: getCharacterization(school),
                specificChallenges: [],
                tier: getTier(school)
            }));
            
            const tier1 = schoolsForAnalysis.filter(s => s.tier === 1);
            const tier2 = schoolsForAnalysis.filter(s => s.tier === 2);
            const tier3 = schoolsForAnalysis.filter(s => s.tier === 3);

            const summary = {
                totalSchools: data.length,
                totalStudents: data.reduce((sum, s) => sum + (parseInt(s.students) || 0), 0),
                riskySchools: tier3.length,
                excellentSchools: tier1.length,
            };

            const challengesAnalysis: AnalysisData['challengesAnalysis'] = {};
            NEW_CHALLENGE_CATEGORIES.forEach(mainCat => {
                const categoryChallenges: Record<string, number> = {};
                const affectedSchools = new Set<number>();
                mainCat.subCategories.forEach(subCat => {
                    const challengesKey = `${subCat.key}Challenges` as keyof School;
                    data.forEach(school => {
                        const selectedChallengeIndices = (school[challengesKey] as number[]) || [];
                        if (selectedChallengeIndices.length > 0) {
                            affectedSchools.add(school.id);
                        }
                        selectedChallengeIndices.forEach(index => {
                            const challengeText = CHALLENGES[subCat.key]?.[index];
                            if (challengeText) {
                                categoryChallenges[challengeText] = (categoryChallenges[challengeText] || 0) + 1;
                            }
                        });
                    });
                });
                if (Object.keys(categoryChallenges).length > 0) {
                    challengesAnalysis[mainCat.name] = {
                        challenges: categoryChallenges,
                        affectedSchools: affectedSchools.size,
                    };
                }
            });

            const subjectDistribution: AnalysisData['subjectDistribution'] = {};
            const coreSubjectsCategory = NEW_CHALLENGE_CATEGORIES.find(c => c.name === 'הישגים בתחומי הליבה');
            if (coreSubjectsCategory) {
                coreSubjectsCategory.subCategories.forEach(subCat => {
                    const field = `${subCat.key}Score`;
                    const hebrewName = subCat.name;
                    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
                    data.forEach(school => {
                        const score = school[field as keyof School] as Score;
                        if (score && distribution.hasOwnProperty(score)) {
                            distribution[score]++;
                        }
                    });
                    subjectDistribution[hebrewName] = distribution;
                });
            }
            
            const orgCategory = NEW_CHALLENGE_CATEGORIES.find(c => c.name === 'מנהיגות ותרבות בית ספרית');
            const orgFields = orgCategory ? orgCategory.subCategories.map(sc => `${sc.key}Score`) : [];
            const organizationalData = orgFields.map(field => {
                const scores = data.map(s => parseInt(s[field as keyof School] as string) || 0).filter(s => s > 0);
                return { name: FIELD_HEBREW_MAP[field], value: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0 };
            });

            const coreSubjectFields = coreSubjectsCategory ? coreSubjectsCategory.subCategories.map(sc => `${sc.key}Score`) : [];
            const coreSubjectsData = coreSubjectFields.map(field => {
                const scores = data.map(s => parseInt(s[field as keyof School] as string) || 0).filter(s => s > 0);
                return { name: FIELD_HEBREW_MAP[field], value: scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0 };
            });

            const overallPerformanceData = [
                { name: 'רמה 3 (נמוך)', value: tier3.length },
                { name: 'רמה 2 (בינוני)', value: tier2.length },
                { name: 'רמה 1 (גבוה)', value: tier1.length }
            ];

            const schoolSizeData = [
                { name: 'קטן (עד 250)', value: data.filter(s => (parseInt(s.students) || 0) <= 250).length },
                { name: 'בינוני (251-400)', value: data.filter(s => (parseInt(s.students) || 0) > 250 && (parseInt(s.students) || 0) <= 400).length },
                { name: 'גדול (401-600)', value: data.filter(s => (parseInt(s.students) || 0) > 400 && (parseInt(s.students) || 0) <= 600).length },
                { name: 'גדול מאוד (600+)', value: data.filter(s => (parseInt(s.students) || 0) > 600).length },
            ].filter(d => d.value > 0);

            const heatmapData = ALL_FIELDS_FOR_HEATMAP.map(field => {
                const lowSchools = data.filter(s => (parseInt(s[field as keyof School] as string) || 0) <= 2).length;
                const percentage = data.length > 0 ? Math.round((lowSchools / data.length) * 100) : 0;
                return { field: FIELD_HEBREW_MAP[field], percentage, lowSchools };
            });

            return {
                schools: schoolsForAnalysis,
                summary,
                subjectDistribution,
                challengesAnalysis,
                mtssClassification: { tier1, tier2, tier3 },
                insights: [],
                heatmapData,
                organizationalData,
                coreSubjectsData,
                overallPerformanceData,
                schoolSizeData,
            };
        };
    }, []);

    useEffect(() => {
        setLoading(true);
        const data = performAnalysis(schoolsData);
        generateInsights(data).then(insights => {
            setAnalysisData({ ...data, insights });
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setAnalysisData({ ...data, insights: [{ title: 'שגיאה', text: 'לא ניתן היה להפיק תובנות AI.' }]});
            setLoading(false);
        });
    }, [schoolsData, performAnalysis]);
    
    if (loading) {
        return <LoadingSpinner />;
    }

    if (!analysisData) {
        return <div className="text-center p-8 text-red-500">לא הצלחנו לנתח את הנתונים.</div>;
    }
    
    const { summary, mtssClassification, insights, heatmapData, organizationalData, schoolSizeData, subjectDistribution, challengesAnalysis } = analysisData;

    const coreSubjectsDistributionData = Object.entries(subjectDistribution).map(([name, dist]) => ({
        name,
        'רמה 1-2': dist['1'] + dist['2'],
        'רמה 3': dist['3'],
        'רמה 4-5': dist['4'] + dist['5'],
    }));

    const sortedChallenges = Object.entries(challengesAnalysis)
        .sort(([, a], [, b]) => b.affectedSchools - a.affectedSchools);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-blue-100 p-6 rounded-xl shadow-md text-center"><h3 className="text-blue-800 text-lg font-semibold">📚 סך בתי ספר</h3><div className="text-blue-900 text-4xl font-bold mt-2">{summary.totalSchools}</div></div>
                <div className="bg-green-100 p-6 rounded-xl shadow-md text-center"><h3 className="text-green-800 text-lg font-semibold">👨‍🎓 סך תלמידים</h3><div className="text-green-900 text-4xl font-bold mt-2">{summary.totalStudents.toLocaleString()}</div></div>
                <div className="bg-red-100 p-6 rounded-xl shadow-md text-center"><h3 className="text-red-800 text-lg font-semibold">⚠️ בתי ספר בסיכון</h3><div className="text-red-900 text-4xl font-bold mt-2">{summary.riskySchools}</div></div>
                <div className="bg-yellow-100 p-6 rounded-xl shadow-md text-center"><h3 className="text-yellow-800 text-lg font-semibold">⭐ בתי ספר מובילים</h3><div className="text-yellow-900 text-4xl font-bold mt-2">{summary.excellentSchools}</div></div>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">🎯 סיווג MTSS - חלוקה לשכבות התערבות</h2>
                 <div className="space-y-6">
                    <TierDisplay tier="tier1" schools={mtssClassification.tier1} />
                    <TierDisplay tier="tier2" schools={mtssClassification.tier2} />
                    <TierDisplay tier="tier3" schools={mtssClassification.tier3} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">🌡️ מפת חום - אחוז בתי ספר עם ציון נמוך (1-2)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={heatmapData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="field" />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                            <Radar name="אחוז בתי ספר" dataKey="percentage" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                            <Tooltip formatter={(value) => `${value}%`} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                     <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">🏢 מנהיגות ותרבות (ממוצע)</h3>
                     <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={organizationalData} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis type="number" domain={[0, 5]}/>
                             <YAxis type="category" dataKey="name" width={100} />
                             <Tooltip />
                             <Bar dataKey="value" fill="#82ca9d" />
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
                 <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                     <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">📈 מדד תפקוד כללי (מס' בתי ספר)</h3>
                     <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={analysisData.overallPerformanceData}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="name" />
                             <YAxis />
                             <Tooltip />
                             <Bar dataKey="value">
                                {analysisData.overallPerformanceData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                             </Bar>
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
                 <div className="bg-gray-50 p-6 rounded-lg shadow-md">
                     <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">🏢 התפלגות גודל בתי ספר</h3>
                     <ResponsiveContainer width="100%" height={300}>
                         <PieChart>
                            <Pie data={schoolSizeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {schoolSizeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                         </PieChart>
                     </ResponsiveContainer>
                 </div>
                 <div className="bg-gray-50 p-6 rounded-lg shadow-md lg:col-span-2">
                     <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">🎓 התפלגות ציונים בתחומי הליבה</h3>
                     <ResponsiveContainer width="100%" height={300}>
                         <BarChart data={coreSubjectsDistributionData}>
                             <CartesianGrid strokeDasharray="3 3" />
                             <XAxis dataKey="name" />
                             <YAxis />
                             <Tooltip />
                             <Legend />
                             <Bar dataKey="רמה 1-2" stackId="a" fill="#e74c3c" />
                             <Bar dataKey="רמה 3" stackId="a" fill="#f39c12" />
                             <Bar dataKey="רמה 4-5" stackId="a" fill="#27ae60" />
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
            </div>
            
             <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">🎯 ניתוח אתגרים מקצועיים</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sortedChallenges.length > 0 ? sortedChallenges.map(([categoryName, categoryData]) => (
                        <div key={categoryName} className="bg-white p-6 rounded-lg shadow-md border-r-4 border-blue-500">
                            <h3 className="text-lg font-bold text-blue-800">{categoryName}</h3>
                            <p className="text-sm text-gray-500 mb-3">זוהה ב-{categoryData.affectedSchools} בתי ספר</p>
                            <div className="space-y-2">
                                {Object.entries(categoryData.challenges).sort(([, a], [, b]) => b - a).slice(0, 5).map(([challenge, count]) => (
                                    <div key={challenge} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                        <span className="text-gray-700 flex-1 pr-2">{challenge}</span>
                                        <span className="font-bold bg-blue-200 text-blue-800 rounded-full px-2.5 py-0.5">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 col-span-full">לא זוהו אתגרים מקצועיים בנתונים שהוזנו.</p>
                    )}
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">💡 תובנות מרכזיות ודפוסים (מבוסס AI)</h2>
                <div className="space-y-4">
                    {insights.map((insight, index) => (
                        <div key={index} className="bg-gradient-to-r from-teal-50 to-blue-50 p-5 rounded-lg border-r-4 border-teal-500 shadow">
                            <h4 className="font-bold text-teal-800 text-lg">{insight.title}</h4>
                            <p className="text-gray-700 mt-1">{insight.text}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 text-center">
                <button onClick={() => onAnalysisComplete(analysisData)} className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white text-lg font-bold rounded-lg shadow-xl hover:from-green-600 hover:to-teal-700 transition transform hover:scale-105">
                   המשך להגדרת סוגייה מרכזית ←
                </button>
            </div>
        </div>
    );
};

export default AnalysisDashboard;
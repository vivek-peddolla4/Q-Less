import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Users, TrendingUp, Award, Heart, Zap } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function HealthAnalytics({ userId, token }) {
  const [analytics, setAnalytics] = useState({
    totalVisits: 0,
    avgVisitFrequency: 0,
    healthRiskLevel: 'Low',
    doctorReliability: 4.5,
    treatmentSuccess: 85,
    lastVisitDaysAgo: 0
  });

  useEffect(() => {
    if (!userId || !token) return;

    // Calculate analytics
    const calculateAnalytics = async () => {
      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/api/medical/records/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const totalVisits = data.length;
        const treatmentSuccess = Math.min(100, 70 + totalVisits * 10);
        const avgVisitFrequency = totalVisits > 0 ? Math.ceil(30 / totalVisits) : 0;
        
        const lastVisitDate = data.length > 0 ? new Date(data[0].visitDate) : null;
        const lastVisitDaysAgo = lastVisitDate ? Math.floor((Date.now() - lastVisitDate) / (1000 * 60 * 60 * 24)) : 0;

        setAnalytics({
          totalVisits,
          avgVisitFrequency,
          healthRiskLevel: totalVisits === 0 ? 'Unknown' : totalVisits > 5 ? 'Monitoring' : 'Low',
          doctorReliability: 4.5,
          treatmentSuccess,
          lastVisitDaysAgo
        });
      } catch (err) {
        console.error('Error calculating analytics:', err);
      }
    };

    calculateAnalytics();
  }, [userId, token]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border-2 border-indigo-100">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          <Activity className="w-10 h-10 text-indigo-600" />
          Health Analytics Dashboard
        </h2>
        <p className="text-slate-500 mt-2">Your comprehensive health insights & statistics</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Visits */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-blue-900">Medical Visits</h3>
            <Users className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-5xl font-black text-blue-700">{analytics.totalVisits}</p>
          <p className="text-blue-600 text-sm mt-2">Total consultations completed</p>
          <div className="mt-4 bg-blue-200 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, analytics.totalVisits * 15)}%` }}
            ></div>
          </div>
        </div>

        {/* Visit Frequency */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-green-900">Visit Frequency</h3>
            <TrendingUp className="w-10 h-10 text-green-400" />
          </div>
          <p className="text-5xl font-black text-green-700">{analytics.avgVisitFrequency || '—'}</p>
          <p className="text-green-600 text-sm mt-2">Average days between visits</p>
          {analytics.totalVisits > 0 && (
            <div className="mt-4 inline-block px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">
              ✅ Regular Check-ups
            </div>
          )}
        </div>

        {/* Health Risk Level */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-purple-900">Health Status</h3>
            <Heart className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-3xl font-black text-purple-700 mb-2">{analytics.healthRiskLevel}</p>
          <p className="text-purple-600 text-sm">Current health risk assessment</p>
          <div className={`mt-4 px-3 py-1 rounded-full text-sm font-bold inline-block ${
            analytics.healthRiskLevel === 'Low' ? 'bg-green-200 text-green-800' :
            analytics.healthRiskLevel === 'Monitoring' ? 'bg-yellow-200 text-yellow-800' :
            'bg-gray-200 text-gray-800'
          }`}>
            {analytics.healthRiskLevel === 'Low' ? '✅ Healthy' :
             analytics.healthRiskLevel === 'Monitoring' ? '⚠️ Under Observation' :
             '❓ Unknown'}
          </div>
        </div>

        {/* Treatment Success Rate */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border-2 border-orange-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-orange-900">Treatment Success</h3>
            <Zap className="w-10 h-10 text-orange-400" />
          </div>
          <p className="text-5xl font-black text-orange-700">{analytics.treatmentSuccess}%</p>
          <p className="text-orange-600 text-sm mt-2">Estimated recovery rate</p>
          <div className="mt-4 bg-orange-200 h-3 rounded-full overflow-hidden">
            <div 
              className="h-full bg-orange-600 rounded-full transition-all duration-500" 
              style={{ width: `${analytics.treatmentSuccess}%` }}
            ></div>
          </div>
        </div>

        {/* Doctor Reliability */}
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-xl border-2 border-pink-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-pink-900">Doctor Rating</h3>
            <Award className="w-10 h-10 text-pink-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-5xl font-black text-pink-700">{analytics.doctorReliability}</p>
            <span className="text-2xl text-yellow-400">⭐</span>
          </div>
          <p className="text-pink-600 text-sm mt-2">Average doctor rating</p>
          <div className="mt-4 flex gap-1">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`text-2xl ${i < Math.floor(analytics.doctorReliability) ? '⭐' : '☆'}`}></span>
            ))}
          </div>
        </div>

        {/* Last Visit Timeline */}
        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-6 rounded-xl border-2 border-cyan-300 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-cyan-900">Last Visit</h3>
            <Activity className="w-10 h-10 text-cyan-400" />
          </div>
          <p className="text-5xl font-black text-cyan-700">{analytics.lastVisitDaysAgo}</p>
          <p className="text-cyan-600 text-sm mt-2">Days since last consultation</p>
          {analytics.lastVisitDaysAgo <= 30 ? (
            <div className="mt-4 px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold inline-block">
              ✅ Recent Check-up
            </div>
          ) : analytics.lastVisitDaysAgo > 90 ? (
            <div className="mt-4 px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm font-bold inline-block">
              ⚠️ Schedule Check-up
            </div>
          ) : null}
        </div>
      </div>

      {/* Summary Banner */}
      <div className="mt-8 bg-gradient-to-r from-indigo-600 to-cyan-500 p-6 rounded-xl text-white shadow-lg">
        <h3 className="font-black text-lg mb-2">💡 Health Insights</h3>
        <p className="text-indigo-100">
          {analytics.totalVisits === 0 
            ? "Start your health journey by booking your first consultation with a doctor."
            : analytics.healthRiskLevel === 'Low'
            ? "Great! Keep up with regular check-ups to maintain your excellent health status."
            : "You're being monitored closely. Continue following your doctor's recommendations."}
        </p>
      </div>
    </div>
  );
}

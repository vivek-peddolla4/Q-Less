import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Clock, User, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { getDistance } from 'geolib';

const TokenDisplay = () => {
  const { id } = useParams();
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchToken = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get(`http://localhost:8000/api/queue/status/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTokenData(res.data);
      setLoading(false);
    } catch (err) {
      toast.error('Failed to load token details');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();

    // Setup Socket.io
    const user = JSON.parse(localStorage.getItem('user')) || {};
    const userId = user.userId || localStorage.getItem('userId');
    const socket = io('http://localhost:8000');

    if (userId) {
      socket.emit('join', userId);
    }

    socket.on('queueUpdate', (data) => {
      fetchToken();
    });

    socket.on('notification', (data) => {
      toast.info(data.message, {
        position: "top-center",
        autoClose: 10000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "colored",
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    if (!tokenData || !tokenData.location || tokenData.status === 'completed' || tokenData.status === 'serving') return;

    if (tokenData.position <= 3) {
      const intervalId = setInterval(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const distance = getDistance(
                { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                { latitude: tokenData.location.lat, longitude: tokenData.location.lng }
              );
              if (distance > 200) {
                toast.warn('Please reach hospital, your turn is approaching.', {
                  position: "top-center",
                  theme: "dark"
                });
              }
            },
            () => {}
          );
        }
      }, 30000); // Check every 30s
      return () => clearInterval(intervalId);
    }
  }, [tokenData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Token Not Found</h2>
        <button 
          onClick={() => navigate('/dashboard')}
          className="mt-6 flex items-center gap-2 text-indigo-600 hover:bg-slate-100 px-4 py-2 rounded-lg transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isServing = tokenData.status === 'serving';
  const isCompleted = tokenData.status === 'completed';

  const appointmentTime = tokenData.appointmentTime 
    ? new Date(tokenData.appointmentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Pending';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center">
      <button 
        onClick={() => navigate('/dashboard')}
        className="self-start flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in duration-500">
        <div className={`p-8 text-white flex flex-col items-center text-center ${
            isServing ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
            isCompleted ? 'bg-gradient-to-r from-slate-500 to-slate-600' :
            tokenData.isEmergency ? 'bg-gradient-to-r from-rose-500 to-red-600' :
            'bg-gradient-to-r from-indigo-500 to-purple-600'
          }`}
        >
          <h2 className="text-sm font-medium uppercase tracking-wider mb-2 opacity-90">Your Token Number</h2>
          <div className="text-6xl font-black mb-2 tracking-tighter">{tokenData.tokenNumber || 'QL-XXX'}</div>
          <p className="text-lg opacity-90 font-medium">{tokenData.department}</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex justify-between items-center pb-6 border-b border-slate-100">
            <div className="flex flex-col">
              <span className="text-sm text-slate-500 font-medium mb-1">Status</span>
              <span className={`font-semibold text-lg capitalize ${
                isServing ? 'text-emerald-600' : 
                isCompleted ? 'text-slate-600' : 
                'text-indigo-600'
              }`}>
                {tokenData.status}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm text-slate-500 font-medium mb-1">Queue Position</span>
              <span className="font-bold text-2xl text-slate-800">
                {isServing ? 'Now Serving' : isCompleted ? '-' : tokenData.position}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-slate-100 transition">
              <Clock className="w-6 h-6 text-indigo-500 mb-2" />
              <span className="text-sm text-slate-500 mb-1">Estimated Time</span>
              <span className="font-semibold text-slate-800">{isServing ? 'Started' : appointmentTime}</span>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center text-center hover:bg-slate-100 transition">
              <User className="w-6 h-6 text-indigo-500 mb-2" />
              <span className="text-sm text-slate-500 mb-1">Urgency</span>
              <span className={`font-semibold ${tokenData.isEmergency ? 'text-rose-600' : 'text-slate-800'}`}>
                {tokenData.urgency}
              </span>
            </div>
          </div>
          
          {(!isCompleted && !isServing) && (
            <div className="mt-6 bg-blue-50/50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed border border-blue-100 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p>Keep this page open to receive real-time updates and notifications when your turn approaches.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenDisplay;

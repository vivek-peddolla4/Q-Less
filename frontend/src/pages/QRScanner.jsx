import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import SymptomForm from '../components/SymptomForm';

const QRScanner = () => {
  const [scanResult, setScanResult] = useState(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Request geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          toast.error("Please enable location services to scan QR codes.");
        }
      );
    }

    const scanner = new Html5QrcodeScanner('reader', {
      qrbox: { width: 250, height: 250 },
      fps: 5,
    });

    scanner.render(onScanSuccess, onScanFailure);

    function onScanSuccess(decodedText) {
      scanner.clear();
      try {
        const data = JSON.parse(decodedText);
        setScanResult(data);
        verifyLocation(data);
      } catch (err) {
        toast.error("Invalid QR Code format.");
      }
    }

    function onScanFailure(error) {
       // ignore
    }

    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
    };
  }, [userLocation]);

  const verifyLocation = async (qrData) => {
    if (!userLocation) {
      toast.error("Location not available. Please allow location access.");
      /* Uncomment for development without strict GPS rules:
      setLocationVerified(true);
      setShowForm(true);
      return;
      */
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post('http://localhost:8000/api/queue/scan-qr', {
        hospitalId: qrData.hospitalId,
        qrLat: qrData.lat,
        qrLng: qrData.lng,
        userLat: userLocation.lat,
        userLng: userLocation.lng
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 200) {
        setLocationVerified(true);
        setShowForm(true);
        toast.success("Location verified! Please enter your details.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Location verification failed.');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.post('http://localhost:8000/api/queue/join-qr', {
        hospitalId: scanResult.hospitalId,
        location: userLocation,
        ...formData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 201) {
        toast.success("Added to Queue successfully!");
        navigate(`/token/${res.data._id}`);
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message === 'You are already in the queue') {
        const { position, department, estimatedWaitTime } = err.response.data;
        toast.warning(`⏳ You are already in the ${department} queue! Position: ${position} | Wait: ${estimatedWaitTime} mins`);
      } else {
        toast.error(err.response?.data?.message || 'Failed to join queue.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent mb-6">Scan Hospital QR</h1>
      
      {!scanResult && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6">
          <div id="reader" className="w-full"></div>
          <p className="text-center text-slate-500 mt-4 text-sm">Position the QR code within the frame.</p>
        </div>
      )}

      {scanResult && !locationVerified && (
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="animate-pulse flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600">Verifying your location...</p>
          </div>
        </div>
      )}

      {showForm && (
        <SymptomForm onSubmit={handleFormSubmit} onCancel={() => {
          setScanResult(null);
          setLocationVerified(false);
          setShowForm(false);
          window.location.reload();
        }} />
      )}
    </div>
  );
};

export default QRScanner;

import { useState } from 'react';
import axios from 'axios';
import { Star, Send, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config';

export default function PatientFeedback({ doctorId, doctorName, medicalRecordId, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rating) {
      toast.error('Please select a rating');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      await axios.post(
        `${API_BASE_URL}/api/medical/feedback`,
        {
          doctorId,
          rating,
          comments: comments.trim() || null,
          medicalRecordId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Thank you! Your feedback has been submitted');
      setIsOpen(false);
      setRating(5);
      setComments('');
      
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Failed to submit feedback: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const RatingStars = ({ value, onHover, onLeave, onClick }) => (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onClick(star)}
          onMouseEnter={() => onHover(star)}
          onMouseLeave={onLeave}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-8 h-8 transition-all ${
              star <= (hoverRating || value)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-slate-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition font-medium text-sm"
      >
        <Star className="w-4 h-4" />
        Rate Doctor
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Rate Your Experience</h2>
            <p className="text-slate-600 text-sm mt-1">How was your visit with Dr. {doctorName}?</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div className="bg-slate-50 p-6 rounded-xl text-center">
            <p className="text-slate-600 font-medium mb-4">Your Rating</p>
            <RatingStars
              value={rating}
              onHover={setHoverRating}
              onLeave={() => setHoverRating(0)}
              onClick={setRating}
            />
            <div className="mt-4 text-sm text-slate-600">
              {rating <= 2 && 'Poor'}
              {rating === 3 && 'Average'}
              {rating === 4 && 'Good'}
              {rating >= 5 && 'Excellent'}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-slate-700 font-semibold mb-3">
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share your feedback about the doctor, treatment quality, communication, etc..."
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-400 outline-none resize-none h-24 transition-all"
            />
            <p className="text-xs text-slate-500 mt-2">
              {comments.length}/500 characters
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

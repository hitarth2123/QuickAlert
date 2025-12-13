import { useNavigate } from 'react-router-dom';
import AlertForm from '../components/Forms/AlertForm';

const AlertCreatePage = () => {
  const navigate = useNavigate();

  const handleSuccess = (alert) => {
    navigate('/alerts', { 
      state: { message: 'Alert created successfully!' } 
    });
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      </div>
      
      <AlertForm 
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default AlertCreatePage;

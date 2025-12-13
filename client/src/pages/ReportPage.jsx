import ReportForm from '../components/Forms/ReportForm';
import { useNavigate } from 'react-router-dom';

const ReportPage = () => {
  const navigate = useNavigate();

  const handleSuccess = (report) => {
    navigate('/dashboard', { 
      state: { message: 'Report submitted successfully!' } 
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ReportForm onSuccess={handleSuccess} />
    </div>
  );
};

export default ReportPage;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Wrench, 
  FileText, 
  Calendar as CalendarIcon, 
  Clock,
  Upload,
  X,
  Eye,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

const BookService = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  
  // Get SMS booking parameters
  const smsPhone = searchParams.get('phone');
  const sessionId = searchParams.get('session');
  const refSource = searchParams.get('ref');
  const isSMSBooking = refSource === 'sms' && smsPhone && sessionId;
  
  const [formData, setFormData] = useState({
    customerName: user?.name || '',
    customerEmail: user?.email || '',
    customerPhone: smsPhone || user?.phone || '',
    address: user?.address || '',
    serviceType: '',
    description: '',
    date: '',
    timeSlot: { start: '', end: '' },
    files: []
  });

  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (isSMSBooking) {
      // Prefill phone number from SMS
      setFormData(prev => ({
        ...prev,
        customerPhone: smsPhone
      }));
    }
  }, [isSMSBooking, smsPhone]);

  const serviceTypes = [
    'Pipe Repair',
    'Leak Fixing', 
    'Drain Cleaning',
    'Water Heater',
    'Toilet Repair',
    'Faucet Installation',
    'Bathroom Renovation',
    'Kitchen Plumbing',
    'Emergency Services'
  ];

  const timeSlots = [
    { start: '08:00', end: '09:00', label: '8:00 AM - 9:00 AM' },
    { start: '09:00', end: '10:00', label: '9:00 AM - 10:00 AM' },
    { start: '10:00', end: '11:00', label: '10:00 AM - 11:00 AM' },
    { start: '11:00', end: '12:00', label: '11:00 AM - 12:00 PM' },
    { start: '12:00', end: '13:00', label: '12:00 PM - 1:00 PM' },
    { start: '13:00', end: '14:00', label: '1:00 PM - 2:00 PM' },
    { start: '14:00', end: '15:00', label: '2:00 PM - 3:00 PM' },
    { start: '15:00', end: '16:00', label: '3:00 PM - 4:00 PM' },
    { start: '16:00', end: '17:00', label: '4:00 PM - 5:00 PM' },
    { start: '17:00', end: '18:00', label: '5:00 PM - 6:00 PM' },
    { start: '18:00', end: '19:00', label: '6:00 PM - 7:00 PM' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleTimeSlotChange = (slot) => {
    setFormData({
      ...formData,
      timeSlot: { start: slot.start, end: slot.end }
    });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingFiles(true);
    const uploadData = new FormData();
    
    files.forEach(file => {
      uploadData.append('files', file);
    });

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/upload`,
        uploadData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setFormData({
        ...formData,
        files: [...formData.files, ...response.data.files]
      });

      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeFile = (index) => {
    const newFiles = formData.files.filter((_, i) => i !== index);
    setFormData({ ...formData, files: newFiles });
  };

  const handleProceedToBook = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customerName || !formData.customerEmail || !formData.customerPhone) {
      toast.error('Please fill in all contact information');
      return;
    }
    
    if (!formData.address || !formData.serviceType || !formData.description) {
      toast.error('Please fill in all service details');
      return;
    }
    
    if (!formData.date || !formData.timeSlot.start) {
      toast.error('Please select date and time');
      return;
    }

    setShowConfirmation(true);
  };

  const handleConfirmBooking = async () => {
    setLoading(true);
    
    try {
      let bookingData = { ...formData };

      if (isSMSBooking) {
        // Use SMS booking endpoint
        bookingData = {
          ...bookingData,
          phone: smsPhone,
          sessionId: sessionId
        };
        
        await axios.post(`${import.meta.env.VITE_API_URL}/bookings/sms-booking`, bookingData);
      } else {
        // Use regular booking endpoint
        await axios.post(`${import.meta.env.VITE_API_URL}/bookings`, bookingData);
      }
      
      toast.success('Booking created successfully!');
      
      if (isSMSBooking) {
        // Show success with SMS instructions
        setShowConfirmation(false);
        setShowSMSSuccess(true);
      } else {
        navigate('/customer');
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error(error.response?.data?.message || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const [showSMSSuccess, setShowSMSSuccess] = useState(false);

  const selectedTimeSlot = timeSlots.find(
    slot => slot.start === formData.timeSlot.start && slot.end === formData.timeSlot.end
  );

  return (
    <Layout title={isSMSBooking ? "Book Service via SMS" : "Book Service"}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* SMS Booking Header */}
        {isSMSBooking && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <MessageCircle className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">SMS Booking</h3>
                <p className="text-sm text-blue-700">
                  Booking for phone: <span className="font-mono font-medium">{smsPhone}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  After booking, you can login to track your order. We'll send you updates via SMS too!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <form onSubmit={handleProceedToBook} className="space-y-8">
            {/* Contact Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Contact Information
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      required
                      className="input-field pl-11"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="customerPhone"
                      value={formData.customerPhone}
                      onChange={handleChange}
                      required
                      className="input-field pl-11"
                      placeholder="Enter your phone number"
                      readOnly={isSMSBooking}
                    />
                  </div>
                  {isSMSBooking && (
                    <p className="text-xs text-gray-500 mt-1">Phone number from SMS booking</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    name="customerEmail"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    required
                    className="input-field pl-11"
                    placeholder="Enter your email address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Address *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                    rows="2"
                    className="input-field pl-11"
                    placeholder="Enter the address where service is needed"
                  />
                </div>
              </div>
            </div>

            {/* Service Details */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Service Details
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Type *
                </label>
                <div className="relative">
                  <Wrench className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <select
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleChange}
                    required
                    className="input-field pl-11"
                  >
                    <option value="">Select service type</option>
                    {serviceTypes.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows="4"
                    className="input-field pl-11"
                    placeholder="Describe the issue or service needed in detail..."
                  />
                </div>
              </div>
            </div>

            {/* Date and Time */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Schedule Service
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date *
                  </label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                      required
                      min={new Date().toISOString().split('T')[0]}
                      className="input-field pl-11"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Time Slot *
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {timeSlots.map((slot) => (
                      <button
                        key={`${slot.start}-${slot.end}`}
                        type="button"
                        onClick={() => handleTimeSlotChange(slot)}
                        className={`p-3 text-left border rounded-lg transition-colors ${
                          formData.timeSlot.start === slot.start
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {slot.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                Photos & Videos (Optional)
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Photos or Videos
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none"
                      >
                        <span>Upload files</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          multiple
                          accept="image/*,video/*"
                          onChange={handleFileUpload}
                          disabled={uploadingFiles}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, GIF, MP4, MOV up to 10MB each
                    </p>
                  </div>
                </div>

                {uploadingFiles && (
                  <div className="mt-4 text-center">
                    <div className="spinner w-6 h-6 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Uploading files...</p>
                  </div>
                )}

                {/* File Preview */}
                {formData.files.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {formData.files.map((file, index) => (
                      <div key={index} className="relative border rounded-lg overflow-hidden">
                        {file.type === 'image' ? (
                          <img
                            src={file.url}
                            alt={file.originalName}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              <FileText className="w-6 h-6 text-gray-400 mx-auto" />
                              <p className="text-xs text-gray-500 mt-1">Video</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="absolute top-1 right-1 flex space-x-1">
                          <button
                            type="button"
                            onClick={() => window.open(file.url, '_blank')}
                            className="bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-75"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="bg-red-500 bg-opacity-75 text-white p-1 rounded-full hover:bg-opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        
                        <div className="p-2">
                          <p className="text-xs text-gray-500 truncate">
                            {file.originalName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Login/Signup Info for SMS users */}
            {isSMSBooking && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Track Your Order Online</h4>
                <p className="text-sm text-green-700 mb-3">
                  After booking, you can create an account to track your order status, view updates, and manage future bookings.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href="/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Login to Existing Account
                  </a>
                  <a
                    href="/register"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 text-sm bg-white text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Create New Account
                  </a>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? <span className="spinner mr-2"></span> : null}
                Proceed to Book
              </button>
            </div>
          </form>

          {/* Confirmation Modal */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-6">Confirm Your Booking</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Customer</p>
                        <p className="text-gray-900">{formData.customerName}</p>
                        <p className="text-sm text-gray-600">{formData.customerEmail}</p>
                        <p className="text-sm text-gray-600">{formData.customerPhone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">Service</p>
                        <p className="text-gray-900">{formData.serviceType}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(formData.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {selectedTimeSlot?.label}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Address</p>
                      <p className="text-gray-900">{formData.address}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-gray-700">Description</p>
                      <p className="text-gray-900">{formData.description}</p>
                    </div>

                    {formData.files.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Uploaded Files</p>
                        <p className="text-sm text-gray-600">
                          {formData.files.length} file(s) uploaded
                        </p>
                      </div>
                    )}

                    {isSMSBooking && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">SMS Booking</p>
                        <p className="text-xs text-blue-700">
                          This booking was initiated via SMS. You'll receive updates on your phone and can track online.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="btn-secondary flex-1"
                    >
                      Back to Edit
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      disabled={loading}
                      className="btn-primary flex-1"
                    >
                      {loading ? <span className="spinner mr-2"></span> : null}
                      Confirm Booking
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SMS Success Modal */}
          {showSMSSuccess && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Booking Confirmed! 🎉</h3>
                  <p className="text-gray-600 mb-6">
                    Your plumbing service has been booked successfully. We'll send you SMS updates and notifications.
                  </p>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <h4 className="font-medium text-green-900 mb-2">What's Next?</h4>
                    <ul className="text-sm text-green-700 text-left space-y-1">
                      <li>✅ Our certified plumbers will review your request</li>
                      <li>✅ You'll get an SMS when a plumber accepts</li>
                      <li>✅ Track everything online by creating an account</li>
                      <li>✅ Get real-time updates via SMS</li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3">
                    <a
                      href="/register"
                      className="btn-primary"
                    >
                      Create Account to Track Online
                    </a>
                    <button
                      onClick={() => {
                        setShowSMSSuccess(false);
                        navigate('/');
                      }}
                      className="btn-secondary"
                    >
                      Done - I'll Track via SMS
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-4">
                    You can close this page now. We'll keep you updated via SMS to {smsPhone}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default BookService;
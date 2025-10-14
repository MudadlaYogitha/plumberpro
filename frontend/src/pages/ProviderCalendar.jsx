import React from 'react';
import ProviderLayout from '../components/ProviderLayout';
import Calendar from '../components/Calendar';

const ProviderCalendar = () => {
  return (
    <ProviderLayout title="Calendar">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">My Calendar</h2>
          <p className="text-gray-600">Manage your service schedule and appointments</p>
        </div>
        
        <Calendar role="provider" />
      </div>
    </ProviderLayout>
  );
};

export default ProviderCalendar;
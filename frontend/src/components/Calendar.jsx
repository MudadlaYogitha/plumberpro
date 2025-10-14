import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import BookingModal from './BookingModal';

const localizer = momentLocalizer(moment);

const Calendar = ({ role = 'customer' }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // refetch when role or user changes
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const endpoint =
        role === 'provider' ? '/bookings/provider/calendar' : '/bookings/customer/calendar';
      const res = await api.get(endpoint);
      const raw = res.data || [];

      // Normalize events: ensure start and end are Date objects and include a sensible title
      const normalized = raw.map((ev) => {
        // ev.start and ev.end could be ISO strings from backend; convert to Date
        let start = ev.start ? new Date(ev.start) : null;
        let end = ev.end ? new Date(ev.end) : null;

        // If backend returned booking with date + timeSlot instead, try to construct
        if ((!start || !end) && ev.booking) {
          const booking = ev.booking;
          try {
            const dateStr = booking.date ? new Date(booking.date).toISOString().split('T')[0] : null;
            const startTime = booking.timeSlot?.start;
            const endTime = booking.timeSlot?.end;
            if (dateStr && startTime) start = new Date(`${dateStr}T${startTime}`);
            if (dateStr && endTime) end = new Date(`${dateStr}T${endTime}`);
          } catch (err) {
            // fallback no-op
          }
        }

        // fallback to now if missing (prevents crashes)
        if (!start) start = new Date();
        if (!end) end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour

        return {
          ...ev,
          title: ev.title || (ev.booking?.serviceType ?? 'Service'),
          start,
          end,
          booking: ev.booking ?? ev.booking // keep nested booking for modal
        };
      });

      setEvents(normalized);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
  };

  const eventStyleGetter = (event) => {
    const backgroundColor = event.color || event.booking?.color || '#3b82f6';
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.95,
        color: 'white',
        border: 'none',
        display: 'block',
        padding: '4px'
      }
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-soft">
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">
          {role === 'provider' ? 'My Service Calendar' : 'My Bookings Calendar'}
        </h3>

        <div style={{ height: '600px' }}>
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            defaultDate={new Date()}
            popup
            showMultiDayTimes
            step={30}         // 30 minute grid
            timeslots={2}     // 30-minutes * 2 = hour grouping in time grid
            tooltipAccessor={(event) => `${event.title} • ${event.booking?.status ?? ''}`}
            formats={{
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start, end }) =>
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
            }}
          />
        </div>
      </div>

      {selectedEvent && (
        <BookingModal
          booking={selectedEvent.booking || selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdate={fetchEvents}
          userRole={role}
        />
      )}
    </div>
  );
};

export default Calendar;

// Test script to verify calendar logic for private events

// Mock data based on the actual API responses
const privateEvents = [
  {
    id: "ef6fde01-20a1-416f-b790-5098f789b7a7",
    title: "Test Event for RSVP Limit",
    start_time: "2025-07-10T18:00:00+00:00",
    end_time: "2025-07-10T21:00:00+00:00",
    require_time_selection: false
  },
  {
    id: "de97d27c-15ad-41d3-bd5b-121cb9f3c1c6",
    title: "Test Event with RSVP",
    start_time: "2025-07-06T23:00:00+00:00",
    end_time: "2025-07-07T02:00:00+00:00",
    require_time_selection: false
  }
];

const reservations = [
  {
    id: "30b09df5-be9a-47a4-bef5-ba697fb321c9",
    table_id: null,
    start_time: "2025-07-04T05:00:00+00:00",
    end_time: "2025-07-04T08:00:00+00:00",
    private_event_id: "a123f2cd-5340-4421-ba09-6f9967b05f55",
    first_name: "Test",
    last_name: "User",
    party_size: 4
  },
  {
    id: "1b4c8734-1058-485a-970c-cbdfa0cba3da",
    table_id: null,
    start_time: "2025-07-06T23:00:00+00:00",
    end_time: "2025-07-07T02:00:00+00:00",
    private_event_id: "de97d27c-15ad-41d3-bd5b-121cb9f3c1c6",
    first_name: "Tim",
    last_name: "Wirick",
    party_size: 4
  },
  {
    id: "780e1075-8021-4cb7-b9f0-e36778788f38",
    table_id: null,
    start_time: "2025-07-10T18:00:00+00:00",
    end_time: "2025-07-10T21:00:00+00:00",
    private_event_id: "ef6fde01-20a1-416f-b790-5098f789b7a7",
    first_name: "Charlie",
    last_name: "Brown",
    party_size: 2
  },
  {
    id: "063e82d2-8683-47fc-a48d-cd23e948e43c",
    table_id: null,
    start_time: "2025-07-10T18:00:00+00:00",
    end_time: "2025-07-10T21:00:00+00:00",
    private_event_id: "ef6fde01-20a1-416f-b790-5098f789b7a7",
    first_name: "Alice",
    last_name: "Smith",
    party_size: 3
  }
];

// Test the logic
function testCalendarLogic() {
  console.log("Testing calendar logic for private events...");
  
  // Test date: July 10, 2025
  const testDate = new Date("2025-07-10T00:00:00.000Z");
  console.log(`Testing for date: ${testDate.toDateString()}`);
  
  // Filter reservations for the test date
  const currentDayReservations = reservations.filter(r => {
    const reservationDate = new Date(r.start_time);
    return reservationDate.toDateString() === testDate.toDateString();
  });
  
  console.log(`Reservations for ${testDate.toDateString()}:`, currentDayReservations);
  
  // Check if there are table reservations
  const hasTableReservations = currentDayReservations.some(r => r.table_id !== null);
  console.log(`Has table reservations: ${hasTableReservations}`);
  
  // Check if there are private event reservations
  const hasPrivateEventReservations = currentDayReservations.some(r => r.table_id === null && r.private_event_id);
  console.log(`Has private event reservations: ${hasPrivateEventReservations}`);
  
  // Check if there are private events that don't require time selection
  const currentDayPrivateEvents = privateEvents.filter(pe => {
    const eventDate = new Date(pe.start_time);
    return eventDate.toDateString() === testDate.toDateString() && !pe.require_time_selection;
  });
  
  console.log(`Private events without time selection:`, currentDayPrivateEvents);
  
  // Determine if we should show only private events resource
  const shouldShowOnlyPrivateEvents = !hasTableReservations && hasPrivateEventReservations && currentDayPrivateEvents.length > 0;
  console.log(`Should show only private events resource: ${shouldShowOnlyPrivateEvents}`);
  
  // Test the event mapping logic
  const mappedEvents = currentDayReservations.map(r => {
    let resourceId, startTime, endTime;
    
    if (r.table_id === null && r.private_event_id) {
      resourceId = 'private-events';
      
      // Find the corresponding private event
      const privateEvent = privateEvents.find(pe => pe.id === r.private_event_id);
      
      if (privateEvent && !privateEvent.require_time_selection) {
        // Use the event start time for stacking
        startTime = new Date(privateEvent.start_time);
        endTime = new Date(privateEvent.end_time);
      } else {
        // Use the reservation's own time
        startTime = new Date(r.start_time);
        endTime = new Date(r.end_time);
      }
    } else {
      resourceId = String(r.table_id);
      startTime = new Date(r.start_time);
      endTime = new Date(r.end_time);
    }
    
    return {
      id: String(r.id),
      title: `${r.first_name} ${r.last_name} | Party Size: ${r.party_size} 🔒`,
      start: startTime,
      end: endTime,
      resourceId: resourceId
    };
  });
  
  console.log("Mapped events:", mappedEvents);
  
  return {
    shouldShowOnlyPrivateEvents,
    mappedEvents,
    currentDayReservations,
    currentDayPrivateEvents
  };
}

// Run the test
const result = testCalendarLogic();
console.log("\nTest Results:", result); 
// Screenshot harness only. Never merge.
import dynamic from 'next/dynamic';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

if (typeof window !== 'undefined' && !(window as any).__harness) {
  (window as any).__harness = true;
  const real = window.fetch.bind(window);
  const start = new Date(Date.now() + 3 * 3600e3).toISOString();
  const end = new Date(Date.now() + 5 * 3600e3).toISOString();
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/api/reservations/r1')) {
      return json({ id: 'r1', first_name: 'Nik', last_name: 'Hiremath', email: 'nik@example.com', phone: '+15550100123', party_size: 2, event_type: '', notes: '', table_id: 't3', start_time: start, end_time: end, status: 'confirmed', checked_in: false, tables: { table_number: 3 }, membership_type: 'member' });
    }
    if (url.includes('/guests')) {
      return json({ guests: [{ id: 'g1', first_name: 'Tim', last_name: null, phone_display: '(555) 010-0199', is_member: true, opted_out: false, checked_in_at: null, notified_at: null }] });
    }
    if (url.includes('/api/tables')) {
      return json({ data: [{ id: 't3', table_number: 3, seats: 4 }, { id: 't4', table_number: 4, seats: 4 }] });
    }
    return real(input, init);
  };
}

const Modal = dynamic(() => import('../components/ReservationEditModal'), { ssr: false });

export default function Harness() {
  if (typeof window !== 'undefined' && window.location.search.includes('frame')) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#111', zIndex: 2147483647, padding: 8 }}>
        <iframe src="/zz-harness" style={{ width: 390, height: 844, border: 0, background: '#fff' }} />
      </div>
    );
  }
  return <Modal isOpen reservationId="r1" onClose={() => {}} onReservationUpdated={() => {}} />;
}

import { Box, Heading, SimpleGrid, Stat, StatLabel, StatNumber, Spinner, VStack, Text, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import AdminLayout from '@/components/layouts/AdminLayout';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  join_date?: string;
  monthly_dues?: number;
}

interface LedgerEntry {
  type: string;
  date: string;
  amount: number;
}

interface Stats {
  members: Member[];
  ledger: LedgerEntry[];
  reservations: number;
  outstanding: number;
  loading: boolean;
}

function getNextBirthday(dob?: string) {
  if (!dob) return null;
  const today = new Date();
  const [year, month, day] = dob.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return next;
}

// Utility to get the next occurrence of a weekday (0=Sunday, 1=Monday, ...)
function getNextWeekdayDate(weekday: number) {
  const today = new Date();
  const result = new Date(today);
  result.setHours(0, 0, 0, 0);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  return result;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    members: [],
    ledger: [],
    reservations: 0,
    outstanding: 0,
    loading: true,
  });
  const [reservationDetails, setReservationDetails] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      setStats(s => ({ ...s, loading: true }));
      try {
        // Fetch all members
        const membersRes = await fetch("/api/members");
        const membersData = await membersRes.json();
        // Fetch ledger
        const ledgerRes = await fetch("/api/ledger");
        const ledgerData = await ledgerRes.json();
        // Fetch all upcoming reservations (not just count)
        const reservationsRes = await fetch("/api/reservations?upcoming=1");
        const reservationsData = await reservationsRes.json();
        // Fetch outstanding balances
        const outstandingRes = await fetch("/api/ledger?outstanding=1");
        const outstandingData = await outstandingRes.json();

        setStats({
          members: membersData.data || [],
          ledger: ledgerData.data || [],
          reservations: reservationsData.count || 0,
          outstanding: outstandingData.total || 0,
          loading: false,
        });
        setReservationDetails(reservationsData.data || []);
      } catch (err) {
        setStats({ members: [], ledger: [], reservations: 0, outstanding: 0, loading: false });
        setReservationDetails([]);
      }
    }
    fetchStats();
  }, []);

  if (stats.loading) {
    return (
      <Box p={4}><Spinner size="xl" /></Box>
    );
  }

  // Total Members and Dues
  const totalMembers = stats.members.length;
  const totalDues = stats.members.reduce((sum, m) => sum + (m.monthly_dues || 0), 0);

  // Current Month Finances
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const isThisMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };
  const payments = stats.ledger.filter(tx => tx.type === 'payment' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const purchases = stats.ledger.filter(tx => tx.type === 'purchase' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const ar = Math.abs(purchases) - payments;

  // Next 5 Birthdays
  const membersWithBirthday = stats.members.filter(m => m.dob).map(m => ({
    ...m,
    nextBirthday: getNextBirthday(m.dob)
  })).filter(m => m.nextBirthday).sort((a, b) => (a.nextBirthday as Date).getTime() - (b.nextBirthday as Date).getTime()).slice(0, 5);

  // Next 5 Payments Due (Upcoming Renewals)
  const getNextRenewal = (member: Member) => {
    if (!member.join_date) return null;
    const jd = new Date(member.join_date);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    const day = jd.getDate();
    let candidate = new Date(year, month, day);
    if (candidate < today) {
      if (month === 11) { year += 1; month = 0; }
      else { month += 1; }
      candidate = new Date(year, month, day);
    }
    return candidate;
  };
  const membersWithRenewal = stats.members.map(m => ({
    ...m,
    nextRenewal: getNextRenewal(m)
  })).filter(m => m.nextRenewal).sort((a, b) => (a.nextRenewal as Date).getTime() - (b.nextRenewal as Date).getTime()).slice(0, 5);

  // Calculate seat totals for next Thursday (4), Friday (5), Saturday (6)
  const nextThursday = getNextWeekdayDate(4);
  const nextFriday = getNextWeekdayDate(5);
  const nextSaturday = getNextWeekdayDate(6);

  function isSameDay(date1: Date, date2: Date) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  const thursdaySeats = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextThursday);
  }).reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);

  const fridaySeats = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextFriday);
  }).reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);

  const saturdaySeats = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextSaturday);
  }).reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);

  return (
    <AdminLayout>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8" position="relative" overflow="hidden">
        <Box position="absolute" inset={0} zIndex={0} style={{ pointerEvents: 'none', background: 'radial-gradient(circle at 60% 40%, rgba(165,148,128,0.10) 0, transparent 70%)' }} />
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          {/* Single-stat cards grid */}
          <SimpleGrid columns={4} spacing={20} mb={10} p={20} borderRadius="10px" shadow="0 8px 32px rgba(0, 0, 0, 0.5)">
            {/* Total Members */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">Total Members</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">{totalMembers}</StatNumber>
            </Stat>
            {/* Total Membership Dues */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">Monthly Recurring Revenue</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">${totalDues.toFixed(2)}</StatNumber>
            </Stat>
            
            {/* Outstanding Balances */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">Outstanding Balances</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">${stats.outstanding?.toFixed(2)}</StatNumber>
            </Stat>
           
            
            
            {/* Payments Received */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} Payments Received</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">${payments.toFixed(2)}</StatNumber>
            </Stat>
            {/* Purchases */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} Revenue</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">${Math.abs(purchases).toFixed(2)}</StatNumber>
            </Stat>
            {/* A/R */}
            <Stat bg="#a59480" border="1px solid#ecede8" borderRadius="10px" boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={10} h="100px"
            >
              <StatLabel fontSize="20px" textAlign="left" fontFamily="'Montserrat', sans-serif" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} A/R (Owed to Us)</StatLabel>
              <StatNumber fontSize="40px" textAlign="center" fontFamily="'Montserrat', sans-serif">${ar.toFixed(2)}</StatNumber>
            </Stat>
          </SimpleGrid>
          {/* Multi-stat cards, each in their own row */}
          <Flex justifyContent="left" mt={20} gap={22} shadow="0 8px 32px rgba(0, 0, 0, 0.5)" p={20} borderRadius="10px">
             {/* Upcoming Reservations */}
             <Box width="33%" bg="#a59480" borderRadius="10px" boxShadow="0 8px 32px rgba(53,53,53,0.25)" p={7} minH="300px"
              shadow="0 8px 32px rgba(0, 0, 0, 0.5)"
              fontFamily="'Montserrat', sans-serif"
              display="flex"
              flexDirection="column"
              alignItems="center"
              border="1px solid#ecede8"
            >
              <Text fontSize="24px" textAlign="center" fontFamily="'Montserrat', sans-serif" fontWeight="bold" mb={8}>
                Upcoming Reservations (Seats)
              </Text>
              <Box w="100%" display="flex" flexDirection="column" alignItems="center" gap={6}>
                {/* Thursday */}
                <Box textAlign="center">
                  <Text fontSize="20px" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    {nextThursday.toLocaleDateString(undefined, { weekday: 'long' })} - {nextThursday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                    
                  </Text>
                  <Text fontSize="24px" fontFamily="'Montserrat', sans-serif" fontWeight="bold" mt={1}>{thursdaySeats}</Text>
                </Box>
                {/* Friday */}
                <Box textAlign="center">
                  <Text fontSize="20px" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    {nextFriday.toLocaleDateString(undefined, { weekday: 'long' })} - {nextFriday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                    
                  </Text>
                  <Text fontSize="24px" fontFamily="'Montserrat', sans-serif" fontWeight="bold" mt={1}>{fridaySeats}</Text>
                </Box>
                {/* Saturday */}
                <Box textAlign="center">
                  <Text fontSize="20px" fontFamily="'Montserrat', sans-serif" fontWeight="bold">
                    {nextSaturday.toLocaleDateString(undefined, { weekday: 'long' })} - {nextSaturday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit'})}
                    
                  </Text>
                  <Text fontSize="24px" fontFamily="'Montserrat', sans-serif" fontWeight="bold" mt={1}>{saturdaySeats}</Text>
                </Box>
              </Box>
            </Box>
            {/* Next 5 Birthdays */}
            <Box width="33%" bg="#a59480" borderRadius="10px" boxShadow="0 8px 32px rgba(53,53,53,0.25)" p={7} minH="300px"
              shadow="0 8px 32px rgba(0, 0, 0, 0.5)"
              fontFamily="'Montserrat', sans-serif"
              display="flex"
              flexDirection="column"
              alignItems="center"
              border="1px solid#ecede8"
            >
              <Heading fontSize="24px" textAlign="center" mb={4} fontFamily="'Montserrat', sans-serif" >Next 5 Birthdays</Heading>
              {membersWithBirthday.length === 0 ? <Text fontFamily="'Montserrat', sans-serif" textAlign="center">No upcoming birthdays.</Text> : (
                <VStack align="stretch" spacing={1} mt={2}>
                  {membersWithBirthday.map(m => (
                    <Box key={m.member_id}>
                      <Text fontWeight="bold" fontFamily="'Montserrat', sans-serif" textAlign="center">{m.first_name} {m.last_name}</Text>
                      <Text fontSize="sm" fontFamily="'Montserrat', sans-serif" textAlign="center">{(m.nextBirthday as Date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
            {/* Next 5 Payments Due */}
            <Box width="33%" bg="#a59480" borderRadius="10px" boxShadow="0 8px 32px rgba(53,53,53,0.25)" p={7} minH="300px"
              fontFamily="'Montserrat', sans-serif"
              display="flex"
              flexDirection="column"
              shadow="0 8px 32px rgba(0, 0, 0, 0.5)"
              alignItems="center"
              border="1px solid#ecede8"
            >
              <Heading fontSize="24px" textAlign="center" mb={4} fontFamily="'Montserrat', sans-serif">Next 5 Payments Due</Heading>
              {membersWithRenewal.length === 0 ? <Text fontFamily="'Montserrat', sans-serif" textAlign="center">No upcoming payments.</Text> : (
                <VStack align="stretch" spacing={1} mt={2}>
                  {membersWithRenewal.map(m => (
                    <Box key={m.member_id} display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Text fontSize="18px"fontWeight="bold" fontFamily="'Montserrat', sans-serif" textAlign="left">{m.first_name} {m.last_name} | {(m.nextRenewal as Date).toLocaleDateString()}</Text>
                        <Text fontSize="sm" fontFamily="'Montserrat', sans-serif" textAlign="left">${(m.monthly_dues || 0).toFixed(2)}</Text>
                        
                      </Box>
                      
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
          </Flex>
        </Box>
      </Box>
    </AdminLayout>
  );
} 
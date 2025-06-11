import { Box, Heading, SimpleGrid, Stat, StatLabel, StatNumber, Spinner, VStack, Text, Link as ChakraLink } from "@chakra-ui/react";
import { useEffect, useState } from "react";

function getNextBirthday(dob) {
  if (!dob) return null;
  const today = new Date();
  const [year, month, day] = dob.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return next;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    members: [],
    ledger: [],
    reservations: 0,
    outstanding: 0,
    loading: true,
  });

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
        // Fetch upcoming reservations
        const reservationsRes = await fetch("/api/reservations?upcoming=1");
        const reservationsData = await reservationsRes.json();
        // Fetch outstanding balances
        const outstandingRes = await fetch("/api/ledger?outstanding=1");
        const outstandingData = await outstandingRes.json();

        // **DEBUG**: inspect what came back
        console.log({ membersData, ledgerData, reservationsData, outstandingData });

        setStats({
          members: membersData.data || [],
          ledger: ledgerData.data || [],
          reservations: reservationsData.count || 0,
          outstanding: outstandingData.total || 0,
          loading: false,
        });
      } catch (err) {
        setStats({ members: [], ledger: [], reservations: 0, outstanding: 0, loading: false });
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
  const isThisMonth = (dateStr) => {
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
  })).filter(m => m.nextBirthday).sort((a, b) => a.nextBirthday - b.nextBirthday).slice(0, 5);

  // Next 5 Payments Due (Upcoming Renewals)
  const getNextRenewal = (member) => {
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
  })).filter(m => m.nextRenewal).sort((a, b) => a.nextRenewal - b.nextRenewal).slice(0, 5);

  return (
    <Box p={4}>
      <Heading mb={8}>Admin Dashboard</Heading>
      <SimpleGrid columns={{ base: 1, md: 4 }} spacing={8} mb={10}>
        {/* Total Members */}
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">Total Members</StatLabel>
          <StatNumber fontSize="4xl">{totalMembers}</StatNumber>
        </Stat>
        {/* Total Membership Dues */}
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">Total Membership Dues</StatLabel>
          <StatNumber fontSize="2xl">${totalDues.toFixed(2)}</StatNumber>
        </Stat>
        {/* Upcoming Reservations */}
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">Upcoming Reservations</StatLabel>
          <StatNumber fontSize="2xl">{stats.reservations}</StatNumber>
        </Stat>
        {/* Outstanding Balances */}
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">Outstanding Balances</StatLabel>
          <StatNumber fontSize="2xl">${stats.outstanding?.toFixed(2)}</StatNumber>
        </Stat>
        {/* June Revenue & Receivables */}
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} Payments Received</StatLabel>
          <StatNumber fontSize="2xl">${payments.toFixed(2)}</StatNumber>
        </Stat>
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} Purchases (Client Spend)</StatLabel>
          <StatNumber fontSize="2xl">${Math.abs(purchases).toFixed(2)}</StatNumber>
        </Stat>
        <Stat bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <StatLabel fontSize="lg" fontWeight="bold">{now.toLocaleString('default', { month: 'long' })} A/R (Owed to Us)</StatLabel>
          <StatNumber fontSize="2xl">${ar.toFixed(2)}</StatNumber>
        </Stat>
        {/* Next 5 Birthdays */}
        <Box bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <Heading size="sm" mb={4}>Next 5 Birthdays</Heading>
          {membersWithBirthday.length === 0 ? <Text>No upcoming birthdays.</Text> : (
            <VStack align="stretch" spacing={1} mt={2}>
              {membersWithBirthday.map(m => (
                <Box key={m.member_id}>
                  <Text fontWeight="bold">{m.first_name} {m.last_name}</Text>
                  <Text fontSize="sm">{m.nextBirthday.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
        {/* Next 5 Payments Due */}
        <Box bg="white" borderRadius="lg" boxShadow="sm" p={6}>
          <Heading size="sm" mb={4}>Next 5 Payments Due</Heading>
          {membersWithRenewal.length === 0 ? <Text>No upcoming payments.</Text> : (
            <VStack align="stretch" spacing={1} mt={2}>
              {membersWithRenewal.map(m => (
                <Box key={m.member_id} display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Text fontWeight="bold">{m.first_name} {m.last_name}</Text>
                    <Text fontSize="sm">{m.nextRenewal.toLocaleDateString()}</Text>
                  </Box>
                  <Text fontWeight="bold">${(m.monthly_dues || 0).toFixed(2)}</Text>
                </Box>
              ))}
            </VStack>
          )}
        </Box>
      </SimpleGrid>
    </Box>
  );
} 
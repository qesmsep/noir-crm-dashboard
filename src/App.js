import React, { Suspense, lazy } from "react";
import { Routes, Route, Link, Outlet } from "react-router-dom";
import { Box, HStack, Button, Spinner, Image } from "@chakra-ui/react";
import Reservations from "./pages/admin/reservations";
import { AppContextProvider, useAppContext } from "./context/AppContext";
import logoImg from './assets/images/noir-wedding-day.png';

const HomePage = lazy(() => import("./pages/homepage"));
const Members = lazy(() => import("./pages/members"));
const Dashboard = lazy(() => import("./pages/admin/dashboard"));
const AdminUsers = lazy(() => import("./pages/admin/members-admin"));
const Calendar = lazy(() => import("./pages/admin/calendar"));
const Logout = lazy(() => import("./pages/admin/logout"));
const MemberDetailAdmin = lazy(() => import("./pages/admin/member-detail-admin"));

function AdminLayout() {
  return (
    <Box p={4} bg="greige">
      <Box mt={32} />
      <HStack spacing={4}>
        <Button as={Link} to="/admin/dashboard" colorScheme="blue">Dashboard</Button>
        <Button as={Link} to="/admin/members" colorScheme="blue">Members</Button>
        <Button as={Link} to="/admin/calendar" colorScheme="blue">Calendar</Button>
        <Button as={Link} to="/admin/reservations" colorScheme="blue">Reservations</Button>
      </HStack>
      <Box mt={6}>
        <Outlet />
      </Box>
    </Box>
  );
}

function MainNav() {
  const { user } = useAppContext();
  return (
    <Box as="nav" position="fixed" top={0} left={0} width="100%" zIndex={100} px={8} py={5} display="flex" alignItems="center" justifyContent="space-between" bg="rgba(255,255,255,0.20)" boxShadow="sm">
      <Image src={logoImg} alt="Noir" height="48px" objectFit="contain" />
      <HStack spacing={2}>
        <Button as={Link} to="/" size="sm" variant="ghost" color="white">Home</Button>
        <Button as={Link} to="/members" size="sm" variant="ghost" color="white">Members</Button>
        <Button as={Link} to="/admin" size="sm" variant="ghost" color="white">Admin</Button>
        <Button as={Link} to="/reserve" size="sm" colorScheme="blue" color="white">Book Now</Button>
        {user && (
          <Button as={Link} to="/admin/logout" size="sm" colorScheme="red" color="white">Logout</Button>
        )}
      </HStack>
    </Box>
  );
}

export default function App() {
  return (
    <AppContextProvider>
      <Suspense fallback={<Spinner size="xl" position="fixed" top="50%" left="50%" />}>
        <MainNav />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/members" element={<Members />} />
          <Route path="/admin" element={<AdminLayout />}> 
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="members" element={<AdminUsers />} />
            <Route path="members/:accountId" element={<MemberDetailAdmin />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="logout" element={<Logout />} />
            <Route path="reservations" element={<Reservations />} />
          </Route>
        </Routes>
      </Suspense>
    </AppContextProvider>
  );
}
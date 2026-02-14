import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Heading,
  Icon
} from '@chakra-ui/react';
import { FiUsers, FiFileText, FiCheckSquare, FiCreditCard, FiList } from 'react-icons/fi';
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistManager from '../../components/admin/WaitlistManager';
import ApplicationManager from '../../components/admin/ApplicationManager';
import QuestionnaireManager from '../../components/admin/QuestionnaireManager';
import AgreementManager from '../../components/admin/AgreementManager';
import PaymentSettingsManager from '../../components/admin/PaymentSettingsManager';

export default function AdminMembership() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <AdminLayout>
      <VStack spacing={6} align="stretch">
        <VStack align="start" spacing={2}>
          <Heading size="lg">Membership Management</Heading>
          <Text color="gray.600">
            Manage membership applications, questionnaires, agreements, and payment settings
          </Text>
        </VStack>

        <Tabs index={activeTab} onChange={setActiveTab} variant="enclosed">
          <TabList>
            <Tab>
              <HStack spacing={2}>
                <Icon as={FiList} />
                <Text>Waitlist</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={2}>
                <Icon as={FiUsers} />
                <Text>Applications</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={2}>
                <Icon as={FiFileText} />
                <Text>Questionnaires</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={2}>
                <Icon as={FiCheckSquare} />
                <Text>Agreements</Text>
              </HStack>
            </Tab>
            <Tab>
              <HStack spacing={2}>
                <Icon as={FiCreditCard} />
                <Text>Payment Settings</Text>
              </HStack>
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <WaitlistManager />
            </TabPanel>
            <TabPanel>
              <ApplicationManager />
            </TabPanel>
            <TabPanel>
              <QuestionnaireManager />
            </TabPanel>
            <TabPanel>
              <AgreementManager />
            </TabPanel>
            <TabPanel>
              <PaymentSettingsManager />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </AdminLayout>
  );
} 
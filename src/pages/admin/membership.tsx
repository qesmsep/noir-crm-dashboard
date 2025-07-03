import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  Heading,
  Container
} from '@chakra-ui/react';
import QuestionnaireManager from '../../components/admin/QuestionnaireManager';
import AgreementManager from '../../components/admin/AgreementManager';
import ApplicationManager from '../../components/admin/ApplicationManager';
import PaymentSettingsManager from '../../components/admin/PaymentSettingsManager';
import WaitlistManager from '../../components/admin/WaitlistManager';

export default function MembershipAdmin() {
  return (
    <Container maxW="8xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="lg" mb={2}>Membership Intake Management</Heading>
          <Text color="gray.600">
            Manage questionnaires, agreements, applications, and payment settings for the membership intake process.
          </Text>
        </Box>

        <Tabs size="lg" colorScheme="blue">
          <TabList>
            <Tab>Waitlist</Tab>
            <Tab>Applications</Tab>
            <Tab>Questionnaires</Tab>
            <Tab>Agreements</Tab>
            <Tab>Payment Settings</Tab>
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
    </Container>
  );
}
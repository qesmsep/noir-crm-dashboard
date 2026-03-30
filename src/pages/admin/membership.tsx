import React, { useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import SubscriptionPlansManager from '../../components/admin/SubscriptionPlansManager';
import WaitlistManager from '../../components/admin/WaitlistManager';
import ApplicationManager from '../../components/admin/ApplicationManager';
import QuestionnaireManager from '../../components/admin/QuestionnaireManager';
import AgreementManager from '../../components/admin/AgreementManager';
import IntakeCampaignManager from '../../components/admin/IntakeCampaignManager';
import { Settings, List, Users, FileText, CheckSquare, MessageSquare } from 'lucide-react';
import styles from '../../styles/Membership.module.css';

export default function AdminMembership() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { id: 0, name: 'Membership Plans', icon: Settings, component: SubscriptionPlansManager },
    { id: 1, name: 'Waitlist', icon: List, component: WaitlistManager },
    { id: 2, name: 'Applications', icon: Users, component: ApplicationManager },
    { id: 3, name: 'Questionnaires', icon: FileText, component: QuestionnaireManager },
    { id: 4, name: 'Agreements', icon: CheckSquare, component: AgreementManager },
    { id: 5, name: 'Intake Campaigns', icon: MessageSquare, component: IntakeCampaignManager },
  ];

  const ActiveComponent = tabs[activeTab].component;

  return (
    <AdminLayout>
      <div className={styles.container}>
        {/* Watermark Logo */}
        <div className={styles.watermark}>
          <img
            src="/images/noir-wedding-day.png"
            alt=""
            aria-hidden="true"
            className={styles.watermarkImage}
          />
        </div>

        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className={styles.pageTitle}>Membership Management</h1>
            <p className={styles.subtitle}>
              Manage membership applications, questionnaires, and agreements
            </p>
          </div>
        </div>

        <div className={styles.tabContainer}>
          <div className={styles.tabList}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={20} strokeWidth={2} />
                  <span className={styles.tabText}>{tab.name}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.tabContent}>
            <ActiveComponent />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

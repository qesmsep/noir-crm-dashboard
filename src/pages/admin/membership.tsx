import React, { useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistManager from '../../components/admin/WaitlistManager';
import ApplicationManager from '../../components/admin/ApplicationManager';
import QuestionnaireManager from '../../components/admin/QuestionnaireManager';
import AgreementManager from '../../components/admin/AgreementManager';
import PaymentSettingsManager from '../../components/admin/PaymentSettingsManager';
import { List, Users, FileText, CheckSquare, CreditCard } from 'lucide-react';
import styles from '../../styles/Membership.module.css';

export default function AdminMembership() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { id: 0, name: 'Waitlist', icon: List, component: WaitlistManager },
    { id: 1, name: 'Applications', icon: Users, component: ApplicationManager },
    { id: 2, name: 'Questionnaires', icon: FileText, component: QuestionnaireManager },
    { id: 3, name: 'Agreements', icon: CheckSquare, component: AgreementManager },
    { id: 4, name: 'Payment Settings', icon: CreditCard, component: PaymentSettingsManager },
  ];

  const ActiveComponent = tabs[activeTab].component;

  return (
    <AdminLayout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h1 className={styles.pageTitle}>Membership Management</h1>
            <p className={styles.subtitle}>
              Manage membership applications, questionnaires, agreements, and payment settings
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
                  <Icon size={18} strokeWidth={2} />
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

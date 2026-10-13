import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/Shell';
import { Button } from '@/components/ui';
import { ApiError, fetchMe } from '@/lib/api';
import { AccountPage, LoginPage, RegisterPage } from '@/pages/AuthPages';
import { BatchDetailPage, BatchesPage } from '@/pages/BatchPages';
import { EggsPage } from '@/pages/EggPages';
import { IncubationDetailPage, IncubationPage } from '@/pages/IncubationPages';
import { IncubatorDetailPage, IncubatorsPage } from '@/pages/IncubatorPages';
import { ActivityPage, FarmCreatePage, FarmProfilePage, FarmsPage, PeoplePage, ShedsPage } from '@/pages/FarmPages';
import { LossesPage } from '@/pages/LossPages';
import { SalesPage } from '@/pages/SalesPages';
import { HealthPage } from '@/pages/HealthPages';
import { StockPage } from '@/pages/StockPages';
import { TaskDetailPage, TasksPage } from '@/pages/TaskPages';

function RequireAuth() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  if (me.isLoading) return <p className="p-6">{t('common.loading')}</p>;
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;
    return (
      <div className="grid gap-3 p-6">
        <p role="alert">{t('common.errorGeneric')}</p>
        <Button type="button" onClick={() => void me.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  return <AppShell />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<FarmsPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="farms/new" element={<FarmCreatePage />} />
        <Route path="farms/:farmId" element={<FarmProfilePage />} />
        <Route path="farms/:farmId/sheds" element={<ShedsPage />} />
        <Route path="farms/:farmId/batches" element={<BatchesPage />} />
        <Route path="farms/:farmId/eggs" element={<EggsPage />} />
        <Route path="farms/:farmId/incubators" element={<IncubatorsPage />} />
        <Route path="farms/:farmId/incubators/:incubatorId" element={<IncubatorDetailPage />} />
        <Route path="farms/:farmId/incubation" element={<IncubationPage />} />
        <Route path="farms/:farmId/incubation/:sittingId" element={<IncubationDetailPage />} />
        <Route path="farms/:farmId/batches/:batchId" element={<BatchDetailPage />} />
        <Route path="farms/:farmId/tasks" element={<TasksPage />} />
        <Route path="farms/:farmId/tasks/:taskId" element={<TaskDetailPage />} />
        <Route path="farms/:farmId/stock" element={<StockPage />} />
        <Route path="farms/:farmId/health" element={<HealthPage />} />
        <Route path="farms/:farmId/losses" element={<LossesPage />} />
        <Route path="farms/:farmId/sales" element={<SalesPage />} />
        <Route path="farms/:farmId/people" element={<PeoplePage />} />
        <Route path="farms/:farmId/activity" element={<ActivityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import SettingsFlixarr from '@app/components/Settings/SettingsFlixarr';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const FlixarrPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsFlixarr />
    </SettingsLayout>
  );
};

export default FlixarrPage;

import FlixarrSeries from '@app/components/Settings/Flixarr/FlixarrSeries';
import SettingsFlixarr from '@app/components/Settings/SettingsFlixarr';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const FlixarrSeriesPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsFlixarr>
        <FlixarrSeries />
      </SettingsFlixarr>
    </SettingsLayout>
  );
};

export default FlixarrSeriesPage;

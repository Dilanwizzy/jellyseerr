import FlixarrMovies from '@app/components/Settings/Flixarr/FlixarrMovies';
import SettingsFlixarr from '@app/components/Settings/SettingsFlixarr';
import SettingsLayout from '@app/components/Settings/SettingsLayout';
import useRouteGuard from '@app/hooks/useRouteGuard';
import { Permission } from '@app/hooks/useUser';
import type { NextPage } from 'next';

const FlixarrMoviesPage: NextPage = () => {
  useRouteGuard(Permission.ADMIN);
  return (
    <SettingsLayout>
      <SettingsFlixarr>
        <FlixarrMovies />
      </SettingsFlixarr>
    </SettingsLayout>
  );
};

export default FlixarrMoviesPage;

import PageTitle from '@app/components/Common/PageTitle';
import type { SettingsRoute } from '@app/components/Common/SettingsTabs';
import SettingsTabs from '@app/components/Common/SettingsTabs';
import globalMessages from '@app/i18n/globalMessages';
import { CameraIcon, FilmIcon } from '@heroicons/react/solid';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  flixarr: 'Flixarr',
  flixarrSettings: 'Flixarr Settings',
  flixarrSettingsDescription: 'Configure Movies and Series Recommendations',
  toastSettingsSuccess: 'Flixarr settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  movies: 'Movies',
  series: 'Series',
});

type SettingsFlixarrProps = {
  children: React.ReactNode;
};

const SettingsFlixarr = ({ children }: SettingsFlixarrProps) => {
  const intl = useIntl();

  const settingsRoutes: SettingsRoute[] = [
    {
      text: intl.formatMessage(messages.movies),
      content: (
        <span className="flex items-center">
          <FilmIcon className="mr-2 h-4" />
          {intl.formatMessage(messages.movies)}
        </span>
      ),
      route: '/settings/flixarr/movies',
      regex: /^\/settings\/flixarr\/movies/,
    },
    {
      text: intl.formatMessage(messages.series),
      content: (
        <span className="flex items-center">
          <CameraIcon className="mr-2 h-4" />
          {intl.formatMessage(messages.series)}
        </span>
      ),
      route: '/settings/flixarr/series',
      regex: /^\/settings\/flixarr\/series/,
    },
  ];

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.flixarr),
          intl.formatMessage(globalMessages.settings),
        ]}
      />
      <div className="mb-6">
        <h3 className="heading">
          {intl.formatMessage(messages.flixarrSettings)}
        </h3>
        <p className="description">
          {intl.formatMessage(messages.flixarrSettingsDescription)}
        </p>
      </div>
      <SettingsTabs tabType="button" settingsRoutes={settingsRoutes} />
      <div className="section">{children}</div>
    </>
  );
};

export default SettingsFlixarr;

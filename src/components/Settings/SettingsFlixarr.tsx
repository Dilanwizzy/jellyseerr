import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import useSettings from '@app/hooks/useSettings';
import globalMessages from '@app/i18n/globalMessages';
import type { MainSettings } from '@server/lib/settings';
import axios from 'axios';
import { Field, Form, Formik } from 'formik';
import getConfig from 'next/config';
import { defineMessages, useIntl } from 'react-intl';
import { useToasts } from 'react-toast-notifications';
import useSWR, { mutate } from 'swr';

const messages = defineMessages({
  flixarr: 'Flixarr',
  flixarrSettings: 'Flixarr Settings',
  flixarrSettingsDescription: 'Configure Movies and TV Shows Recommendations',
  toastSettingsSuccess: 'Flixarr settings saved successfully!',
  toastSettingsFailure: 'Something went wrong while saving settings.',
  totalToRecommend: 'No. Movies To Recommend',
  totalToRecommendTip: 'How many movies you would be recommended',
  maxQuota: 'Max Quota',
  maxQuotaTip: 'Set the Total Size Quota, use (GB|TB). Set 0 for unlimited',
});

const SettingsFlixarr = () => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const {
    data,
    error,
    mutate: revalidate,
  } = useSWR<MainSettings>('/api/v1/settings/main');
  const settings = useSettings();
  const { publicRuntimeConfig } = getConfig();

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <PageTitle
        title={[
          intl.formatMessage(messages.flixarr),
          intl.formatMessage(globalMessages.settings),
        ]}
      />

      <div className="mb-6">
        <h3 className="heading">{intl.formatMessage(messages.flixarr)}</h3>
        <p className="description">
          {intl.formatMessage(messages.flixarrSettingsDescription)}
        </p>
      </div>

      <div className="section">
        <Formik
          initialValues={{
            totalToDownload: data?.movieRecommend.totalToRecommend,
            maxQuota: data?.movieRecommend.maxQuota,
          }}
          enableReinitialize
          onSubmit={async (values) => {
            try {
              await axios.post('/api/v1/settings/main', {
                movieRecommended: values.totalToDownload,
              });

              mutate('/api/v1/settings/public');

              addToast(intl.formatMessage(messages.toastSettingsSuccess), {
                autoDismiss: true,
                appearance: 'success',
              });
            } catch (e) {
              addToast(intl.formatMessage(messages.toastSettingsFailure), {
                autoDismiss: true,
                appearance: 'error',
              });
            } finally {
              revalidate();
            }
          }}
        >
          {({ isSubmitting, values, setFieldValue }) => {
            return (
              <Form className="section">
                <div className="form-row">
                  <label htmlFor="totalToDownload" className="checkbox-label">
                    {intl.formatMessage(messages.totalToRecommend)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.totalToRecommendTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="totalToDownload"
                      name="totalToDownload"
                      className="short"
                      onChange={() => {
                        setFieldValue('localLogin', !values.totalToDownload);
                      }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <label htmlFor="maxQuota" className="checkbox-label">
                    {intl.formatMessage(messages.maxQuota)}
                    <span className="label-tip">
                      {intl.formatMessage(messages.maxQuotaTip)}
                    </span>
                  </label>
                  <div className="form-input-area">
                    <Field
                      type="text"
                      id="maxQuota"
                      name="maxQuota"
                      className="short"
                      onChange={() => {
                        setFieldValue('maxQuota', !values.maxQuota);
                      }}
                    />
                  </div>
                </div>
              </Form>
            );
          }}
        </Formik>
      </div>
    </>
  );
};

export default SettingsFlixarr;

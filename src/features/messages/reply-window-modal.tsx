import { formatHours, windowOptions } from '../../../lib/reply-window';
import { ReasonModal } from '../../components/reason-modal';
import { useT } from '../../../lib/i18n';

// Pick a new reply time to ask the other person for. They have to accept it, and it only applies to
// messages sent after that. Urgent postings also offer shorter times.
export function ReplyWindowModal({
  visible,
  name,
  urgent,
  currentHours,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  name: string;
  urgent: boolean;
  currentHours: number;
  onCancel: () => void;
  // Resolves true when the request was sent.
  onSubmit: (hours: number) => Promise<boolean>;
}) {
  const t = useT();
  return (
    <ReasonModal<string>
      visible={visible}
      title={t('windowModal.title')}
      subtitle={t('windowModal.subtitle', { time: formatHours(currentHours), name })}
      options={windowOptions(urgent)
        .filter((h) => h !== currentHours)
        .map((h) => ({ key: String(h), label: formatHours(h) }))}
      submitLabel={t('windowModal.submit')}
      noNote
      neutral
      chooseLabel={t('windowModal.choose')}
      onCancel={onCancel}
      onSubmit={(key) => onSubmit(Number(key))}
    />
  );
}

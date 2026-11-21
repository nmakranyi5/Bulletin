import { DECLINE_REASONS, DeclineReason } from '../../../lib/decline-reasons';
import { ReasonModal } from '../../components/reason-modal';
import { useT } from '../../../lib/i18n';

// Asks why you're declining before you can send the decline. The other person sees the
// reason (and your note, if you add one), so nobody is left wondering what happened.
export function DeclineModal({
  visible,
  name,
  reasons,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  name: string;
  reasons: DeclineReason[];
  onCancel: () => void;
  // Resolves true when the decline went through.
  onSubmit: (reason: DeclineReason, note: string | null) => Promise<boolean>;
}) {
  const t = useT();
  return (
    <ReasonModal
      visible={visible}
      title={t('declineModal.title')}
      subtitle={t('declineModal.subtitle', { name })}
      options={reasons.map((key) => ({ key, label: DECLINE_REASONS[key] }))}
      submitLabel={t('declineModal.submit')}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

import { CLOSE_REASONS, CloseReason, POSITIVE_CLOSE_REASON } from '../../../lib/close-reasons';
import { ReasonModal } from '../../components/reason-modal';
import { useT } from '../../../lib/i18n';

// Asks why you're closing a chat. Both of you see the reason afterwards, in the
// Archived section.
export function CloseChatModal({
  visible,
  name,
  reasons,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  name: string;
  reasons: CloseReason[];
  onCancel: () => void;
  // Resolves true when the chat was closed.
  onSubmit: (reason: CloseReason, note: string | null) => Promise<boolean>;
}) {
  const t = useT();
  return (
    <ReasonModal
      visible={visible}
      title={t('closeChat.title')}
      subtitle={t('closeChat.subtitle', { name })}
      options={reasons.map((key) => ({
        key,
        label: CLOSE_REASONS[key],
        positive: key === POSITIVE_CLOSE_REASON,
      }))}
      submitLabel={t('closeChat.submit')}
      positiveSubmitLabel={t('closeChat.submitDeal')}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

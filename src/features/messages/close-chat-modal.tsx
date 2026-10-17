import { CLOSE_REASONS, CloseReason, POSITIVE_CLOSE_REASON } from '../../../lib/close-reasons';
import { ReasonModal } from '../../components/reason-modal';

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
  return (
    <ReasonModal
      visible={visible}
      title="Close this chat?"
      subtitle={`It moves to Archived for both of you. ${name} will see how you closed it.`}
      options={reasons.map((key) => ({
        key,
        label: CLOSE_REASONS[key],
        positive: key === POSITIVE_CLOSE_REASON,
      }))}
      submitLabel="Close chat"
      positiveSubmitLabel="Close deal"
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

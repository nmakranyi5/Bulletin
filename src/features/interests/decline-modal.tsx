import { DECLINE_REASONS, DeclineReason } from '../../../lib/decline-reasons';
import { ReasonModal } from '../../components/reason-modal';

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
  return (
    <ReasonModal
      visible={visible}
      title="Why are you declining?"
      subtitle={`${name} will see your reason, so they know where they stand.`}
      options={reasons.map((key) => ({ key, label: DECLINE_REASONS[key] }))}
      submitLabel="Send reason & decline"
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

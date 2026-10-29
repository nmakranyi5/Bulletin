import { formatHours, windowOptions } from '../../../lib/reply-window';
import { ReasonModal } from '../../components/reason-modal';

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
  return (
    <ReasonModal<string>
      visible={visible}
      title="Change the reply time?"
      subtitle={`You're both expected to reply within ${formatHours(currentHours)}. ${name} has to accept a change, and it only applies to messages sent after that.`}
      options={windowOptions(urgent)
        .filter((h) => h !== currentHours)
        .map((h) => ({ key: String(h), label: formatHours(h) }))}
      submitLabel="Ask for this reply time"
      noNote
      neutral
      chooseLabel="Choose a reply time"
      onCancel={onCancel}
      onSubmit={(key) => onSubmit(Number(key))}
    />
  );
}

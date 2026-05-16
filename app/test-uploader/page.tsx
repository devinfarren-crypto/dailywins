'use client';
import ScheduleUploader from '@/src/components/ScheduleUploader';

export default function TestUploaderPage() {
  return (
    <main style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <ScheduleUploader
        onSave={async (schedule) => {
          console.log('Saving schedule:', schedule);
          alert('Saved! Check the browser console for the full data.');
        }}
      />
    </main>
  );
}

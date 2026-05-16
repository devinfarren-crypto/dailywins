'use client';
import ScheduleUploader from '@/src/components/ScheduleUploader';

export default function TestUploaderPage() {
  return (
    <main style={{ padding: 40, maxWidth: 900, margin: '0 auto' }}>
      <ScheduleUploader
        schools={[
          { id: 'a21b868b-aa1a-46a7-a9b8-de1e05c45247', name: 'Pleasant Grove High School' },
          { id: '6a5042af-875d-4722-9591-50b8e648b873', name: 'Cosumnes Oaks High School' },
        ]}
      />
    </main>
  );
}

import QuizContent from './QuizContent';

interface QuizPageProps {
  searchParams: Promise<{
    bankId?: string;
    mode?: 'sequential' | 'random' | 'wrong';
  }>;
}

export default async function QuizPage({ searchParams }: QuizPageProps) {
  const params = await searchParams;

  return (
    <QuizContent bankId={params.bankId} mode={params.mode} />
  );
}

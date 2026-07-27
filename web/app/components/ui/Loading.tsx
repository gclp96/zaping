import Card from './Card';
import LoadingSpinner from './LoadingSpinner';

type LoadingProps = {
  message?: string;
};

export default function Loading({
  message = 'Cargando...'
}: LoadingProps) {
  return (
    <Card className="py-12">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />

        <p className="text-muted-foreground">
          {message}
        </p>
      </div>
    </Card>
  );
}
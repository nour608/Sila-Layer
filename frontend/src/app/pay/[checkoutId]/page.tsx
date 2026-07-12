import PayPage from "@/components/pay/PayPage";

interface PageProps {
  params: Promise<{ checkoutId: string }>;
}

export default async function PayRoute({ params }: PageProps) {
  const { checkoutId } = await params;
  return <PayPage checkoutId={checkoutId} />;
}

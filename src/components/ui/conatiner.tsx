import { cn } from "@/lib/utils";

interface ContainerProps{
    children: React.ReactNode
    className?: string;
}
const Container = ({ children, className }: ContainerProps) => {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-4 md:px-8", className)}>{children}</div>
  )
}

export default Container
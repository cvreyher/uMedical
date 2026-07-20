import Link from 'next/link'
import { PillIcon} from 'lucide-react'

const Logo = () => {
  return (
    <div className="flex items-center gap-2 ">
      <Link href="/" className="font-bold flex items-center gap-2">
        <PillIcon />
        <div>uMedical</div>
      </Link>
    </div>
  )
}

export { Logo }

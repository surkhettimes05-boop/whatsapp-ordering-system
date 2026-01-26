import Link from 'next/link'
import { FiMail, FiPhone } from 'react-icons/fi'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container-custom section-padding">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-white text-xl font-bold mb-4">Khaacho</h3>
            <p className="text-sm text-gray-400 mb-4 max-w-md">
              A WhatsApp-based B2B commerce platform connecting retailers and wholesalers in Nepal. 
              Part of New Bihani Group.
            </p>
            <p className="text-xs text-gray-500">
              Currently operating in Surkhet, Nepal
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/for-retailers" className="hover:text-white transition-colors">
                  For Retailers
                </Link>
              </li>
              <li>
                <Link href="/for-wholesalers" className="hover:text-white transition-colors">
                  For Wholesalers
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="https://wa.me/977XXXXXXXXX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                >
                  <FiPhone className="h-4 w-4" />
                  <span>WhatsApp Sales</span>
                </Link>
              </li>
              <li>
                <a
                  href="mailto:info@khaacho.com"
                  className="flex items-center space-x-2 hover:text-white transition-colors"
                >
                  <FiMail className="h-4 w-4" />
                  <span>info@khaacho.com</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Khaacho by New Bihani Group. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/contact" className="hover:text-gray-300 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/contact" className="hover:text-gray-300 transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}


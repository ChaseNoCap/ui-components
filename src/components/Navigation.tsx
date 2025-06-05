import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Wrench, Moon, Sun, ChevronDown, Settings } from 'lucide-react';
import { TokenStatusIndicator } from './TokenValidation';
import { useTokenValidation } from '../contexts';
import { useTheme } from '../context';
import clsx from 'clsx';

interface DropdownItem {
  label: string;
  path?: string;
  action?: () => void;
}

interface NavItem {
  label: string;
  icon: React.FC<{ className?: string }>;
  path?: string;
  dropdown?: DropdownItem[];
}

export const Navigation: React.FC = () => {
  const { status, isValidating, retryValidation } = useTokenValidation();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      label: 'Health Monitor',
      icon: Activity,
      path: '/',
    },
    {
      label: 'Tools',
      icon: Wrench,
      dropdown: [
        {
          label: 'Change Review',
          path: '/tools/change-review',
        },
        {
          label: 'Claude Console',
          path: '/claude-console',
        },
        {
          label: 'Repository Status',
          path: '/tools/repository-status',
        },
      ],
    },
    {
      label: 'Config',
      icon: Settings,
      path: '/config',
    },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!Object.values(dropdownRefs.current).some(ref => ref?.contains(event.target as Node))) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null);
  }, [location]);

  const isActiveDropdown = (item: NavItem) => {
    if (!item.dropdown) return false;
    return item.dropdown.some(dropItem => 
      dropItem.path ? location.pathname === dropItem.path : false
    ) || location.pathname.startsWith('/tools');
  };

  const renderNavItem = (item: NavItem) => {
    const isDropdown = !!item.dropdown;
    const isActive = item.path ? location.pathname === item.path : isActiveDropdown(item);
    const isOpen = openDropdown === item.label;

    const itemClass = clsx(
      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
      isActive
        ? 'bg-gray-900 text-white dark:bg-gray-700'
        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
    );

    if (isDropdown) {
      return (
        <div 
          key={item.label} 
          className="relative"
          ref={el => dropdownRefs.current[item.label] = el}
        >
          <button
            onClick={() => setOpenDropdown(isOpen ? null : item.label)}
            className={itemClass}
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
            <ChevronDown 
              className={clsx(
                'h-4 w-4 transition-transform',
                isOpen && 'rotate-180'
              )} 
            />
          </button>
          
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              {item.dropdown.map((dropItem, index) => {
                const isFirst = index === 0;
                const isLast = index === item.dropdown!.length - 1;
                
                if (dropItem.action) {
                  return (
                    <button
                      key={dropItem.label}
                      onClick={dropItem.action}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300',
                        'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                        isFirst && 'rounded-t-md',
                        isLast && 'rounded-b-md'
                      )}
                    >
                      {dropItem.label}
                    </button>
                  );
                }
                
                return (
                  <NavLink
                    key={dropItem.label}
                    to={dropItem.path!}
                    className={clsx(
                      'block px-4 py-2 text-sm text-gray-700 dark:text-gray-300',
                      'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors',
                      isFirst && 'rounded-t-md',
                      isLast && 'rounded-b-md'
                    )}
                    onClick={() => setOpenDropdown(null)}
                  >
                    {dropItem.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.label}
        to={item.path!}
        className={({ isActive }) =>
          clsx(
            'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isActive
              ? 'bg-gray-900 text-white dark:bg-gray-700'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
          )
        }
      >
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and primary navigation */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                metaGOTHIC
              </h1>
            </div>
            
            {/* Desktop navigation */}
            <div className="hidden md:block ml-10">
              <div className="flex items-center space-x-4">
                {navItems.map(renderNavItem)}
              </div>
            </div>
          </div>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
            
            <TokenStatusIndicator 
              status={status}
              isValidating={isValidating}
              onRefresh={retryValidation}
              showDetails={true}
            />
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800 shadow-lg">
            {navItems.map((item) => {
              if (item.dropdown) {
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                      className={clsx(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md text-base font-medium transition-colors',
                        isActiveDropdown(item)
                          ? 'bg-gray-900 text-white dark:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                    >
                      <div className="flex items-center space-x-2">
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </div>
                      <ChevronDown 
                        className={clsx(
                          'h-4 w-4 transition-transform',
                          openDropdown === item.label && 'rotate-180'
                        )} 
                      />
                    </button>
                    {openDropdown === item.label && (
                      <div className="pl-8 space-y-1 mt-1">
                        {item.dropdown.map((dropItem) => (
                          <NavLink
                            key={dropItem.label}
                            to={dropItem.path!}
                            className={({ isActive }) =>
                              clsx(
                                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-gray-800 text-white dark:bg-gray-600'
                                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                              )
                            }
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setOpenDropdown(null);
                            }}
                          >
                            {dropItem.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.label}
                  to={item.path!}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors',
                      isActive
                        ? 'bg-gray-900 text-white dark:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    )
                  }
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};
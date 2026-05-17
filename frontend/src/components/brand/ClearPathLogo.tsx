import styles from './ClearPathLogo.module.css'

type Props = {
  size?: number
  showWordmark?: boolean
  variant?: 'light' | 'dark'
}

/** Browser window + simplified form lines + check */
export function ClearPathLogo({ size = 48, showWordmark = false, variant = 'dark' }: Props) {
  return (
    <div className={styles.brand} aria-label="ClearPath">
      <svg
        className={styles.mark}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="14" fill="#e75a7c" />
        <path
          d="M11 15h26a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5V20a5 5 0 0 1 5-5z"
          fill="#f2f5ea"
        />
        <path
          d="M11 15h26a5 5 0 0 1 5 5v6H6v-6a5 5 0 0 1 5-5z"
          fill="#2c363f"
        />
        <circle cx="13.5" cy="20.5" r="1.75" fill="#bbc7a4" />
        <circle cx="18.5" cy="20.5" r="1.75" fill="#d6dbd2" />
        <circle cx="23.5" cy="20.5" r="1.75" fill="#e75a7c" />
        <rect x="13" y="27" width="17" height="2.25" rx="1.125" fill="#bbc7a4" />
        <rect x="13" y="31.25" width="13" height="2.25" rx="1.125" fill="#d6dbd2" />
        <rect x="13" y="35.5" width="9" height="2.25" rx="1.125" fill="#d6dbd2" />
        <circle cx="33.5" cy="33.5" r="7" fill="#bbc7a4" stroke="#2c363f" strokeWidth="1.5" />
        <path
          d="M30.5 33.5 32.5 35.5 36.5 31"
          stroke="#2c363f"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showWordmark && (
        <span className={variant === 'light' ? styles.wordmarkLight : styles.wordmark}>
          ClearPath
        </span>
      )}
    </div>
  )
}

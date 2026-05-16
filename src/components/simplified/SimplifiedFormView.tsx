import { useAccessibility } from '../../context/AccessibilityContext'
import { useSession } from '../../context/SessionContext'
import { SmartHelpBar } from './SmartHelpBar'
import styles from './SimplifiedFormView.module.css'

export function SimplifiedFormView() {
  const { profile, speak } = useAccessibility()
  const {
    simplifiedUi,
    activeFieldId,
    setActiveFieldId,
    updateFieldValue,
    goToStep,
  } = useSession()

  if (!simplifiedUi) return null

  const step = simplifiedUi.currentStep ?? 1
  const total = simplifiedUi.totalSteps ?? 1
  const showAll = !profile.stepByStep
  const visibleFields = showAll
    ? simplifiedUi.fields
    : simplifiedUi.fields.filter((_, i) => i + 1 === step)

  return (
    <div className={styles.wrap}>
      <header className={styles.formHeader}>
        <h2>{simplifiedUi.title}</h2>
        {simplifiedUi.description && <p>{simplifiedUi.description}</p>}
        {profile.stepByStep && total > 1 && (
          <p className={styles.stepLabel} aria-live="polite">
            Step {step} of {total}
          </p>
        )}
      </header>

      <form
        className={styles.form}
        onSubmit={(e) => e.preventDefault()}
        aria-label="Simplified form"
      >
        {visibleFields.map((field) => (
          <div
            key={field.id}
            className={
              activeFieldId === field.id ? styles.fieldActive : styles.field
            }
          >
            <label htmlFor={`field-${field.id}`}>
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </label>
            {field.helpText && (
              <p className={styles.help} id={`help-${field.id}`}>
                {field.helpText}
              </p>
            )}
            {field.type === 'textarea' ? (
              <textarea
                id={`field-${field.id}`}
                value={field.value}
                placeholder={field.placeholder}
                aria-describedby={field.helpText ? `help-${field.id}` : undefined}
                onFocus={() => setActiveFieldId(field.id)}
                onChange={(e) => updateFieldValue(field.id, e.target.value)}
                rows={3}
              />
            ) : (
              <input
                id={`field-${field.id}`}
                type={field.type === 'date' ? 'text' : 'text'}
                inputMode={field.type === 'date' ? 'numeric' : undefined}
                value={field.value}
                placeholder={field.placeholder}
                aria-describedby={field.helpText ? `help-${field.id}` : undefined}
                onFocus={() => {
                  setActiveFieldId(field.id)
                  if (profile.readAloud) speak(field.label)
                }}
                onChange={(e) => updateFieldValue(field.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </form>

      <SmartHelpBar onNext={() => goToStep('next')} onBack={() => goToStep('back')} />
    </div>
  )
}

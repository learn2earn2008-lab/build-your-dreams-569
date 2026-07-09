import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  phone?: string
  source?: string
  submittedAt?: string
}

const NewLeadNotification = ({
  name = 'A new prospect',
  email = 'unknown@example.com',
  phone,
  source = 'landing_page',
  submittedAt,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New lead: {name} just requested the Freedom Legacy Framework</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>Freedom Legacy Elevation Group</Text>
          <Heading style={heading}>New lead captured</Heading>
        </Section>

        <Section style={card}>
          <Row label="Name" value={name} />
          <Hr style={divider} />
          <Row label="Email" value={email} />
          {phone ? (
            <>
              <Hr style={divider} />
              <Row label="Phone" value={phone} />
            </>
          ) : null}
          <Hr style={divider} />
          <Row label="Source" value={source} />
          {submittedAt ? (
            <>
              <Hr style={divider} />
              <Row label="Submitted" value={submittedAt} />
            </>
          ) : null}
        </Section>

        <Text style={footer}>
          Follow up quickly — new prospects convert best within the first hour. You can manage
          this lead inside your CRM.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <table style={rowTable} cellPadding={0} cellSpacing={0}>
    <tbody>
      <tr>
        <td style={rowLabel}>{label}</td>
        <td style={rowValue}>{value}</td>
      </tr>
    </tbody>
  </table>
)

export const template = {
  component: NewLeadNotification,
  subject: (data: Record<string, any>) =>
    `New lead: ${data?.name ?? 'A new prospect'}`,
  displayName: 'New lead notification',
  previewData: {
    name: 'Jordan Carter',
    email: 'jordan@business.com',
    phone: '(555) 123-4567',
    source: 'landing_page',
    submittedAt: 'July 9, 2026, 2:14 PM',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, Helvetica, sans-serif',
}

const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 24px',
}

const header = {
  paddingBottom: '8px',
}

const eyebrow = {
  margin: '0 0 4px',
  fontSize: '12px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#c9a24a',
  fontWeight: 700,
}

const heading = {
  margin: '0',
  fontSize: '24px',
  lineHeight: '1.25',
  color: '#1a2238',
  fontWeight: 700,
}

const card = {
  marginTop: '20px',
  padding: '8px 20px',
  backgroundColor: '#faf8f2',
  border: '1px solid #ece6d5',
  borderRadius: '12px',
}

const rowTable = {
  width: '100%',
}

const rowLabel = {
  padding: '12px 0',
  fontSize: '13px',
  color: '#6b7280',
  width: '30%',
  verticalAlign: 'top' as const,
}

const rowValue = {
  padding: '12px 0',
  fontSize: '14px',
  color: '#1a2238',
  fontWeight: 600,
  textAlign: 'right' as const,
}

const divider = {
  borderColor: '#ece6d5',
  margin: '0',
}

const footer = {
  marginTop: '24px',
  fontSize: '13px',
  lineHeight: '1.6',
  color: '#6b7280',
}

// ─────────────────────────────────────────────
// INFRASTRUCTURE — EmailService (Nodemailer)
// Implementa la interfaz IEmailService del use case.
// ─────────────────────────────────────────────

import nodemailer from 'nodemailer'
import { Shift } from '../../domain/entities/FoodTemperature'
import { IEmailService } from '../../use-cases/temperatures/RecordFoodTemperature'

const SHIFT_LABELS: Record<Shift, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  CLOSING: 'Cierre',
}

export class NodemailerEmailService implements IEmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  async sendTemperatureAlert(params: {
    to: string
    buildingName: string
    foodItem: string
    temperatureC: number
    shift: Shift
  }): Promise<void> {
    const { to, buildingName, foodItem, temperatureC, shift } = params

    await this.transporter.sendMail({
      from: `"Story Land Food Safety" <${process.env.SMTP_USER}>`,
      to,
      subject: `ALERTA de temperatura — ${buildingName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #D85A30;">Temperatura fuera de rango</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Edificio</strong></td><td style="padding: 8px; border: 1px solid #eee;">${buildingName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Producto</strong></td><td style="padding: 8px; border: 1px solid #eee;">${foodItem}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Temperatura registrada</strong></td><td style="padding: 8px; border: 1px solid #eee; color: #D85A30;"><strong>${temperatureC}°C</strong></td></tr>
            <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Turno</strong></td><td style="padding: 8px; border: 1px solid #eee;">${SHIFT_LABELS[shift]}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Hora</strong></td><td style="padding: 8px; border: 1px solid #eee;">${new Date().toLocaleString('es-DO')}</td></tr>
          </table>
          <p style="color: #888; font-size: 12px; margin-top: 24px;">
            Este es un mensaje automático del sistema Story Land Food Safety.
          </p>
        </div>
      `,
    })
  }
}

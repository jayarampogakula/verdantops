package ai.learnbricks.verdantops

import org.apache.spark.sql.SparkSession
import java.net.{HttpURLConnection, URL}
import java.io.{BufferedWriter, OutputStreamWriter}
import java.time.Instant
import scala.util.Try
import scala.concurrent.duration._

object DbxSparkCollector {
  case class UsagePayload(
    source: String = "databricks",
    runId: Option[String],
    cloud: String,                // "azure" | "aws" | "gcp"
    regionCode: String,
    computeType: Option[String],
    nodeCount: Option[Int],
    avgCpuUtilization: Option[Double],
    startedAt: String,
    endedAt: String,
    dbu: Option[Double],
    bytesRead: Option[Long],
    bytesWritten: Option[Long],
    rowsProcessed: Option[Long],
    estKWh: Option[Double]
  )

  private def postJson(endpoint: String, tokenOpt: Option[String], json: String): Int = {
    val url = new URL(endpoint)
    val conn = url.openConnection().asInstanceOf[HttpURLConnection]
    conn.setRequestMethod("POST")
    conn.setRequestProperty("Content-Type", "application/json")
    tokenOpt.foreach(t => conn.setRequestProperty("Authorization", s"Bearer $t"))
    conn.setDoOutput(true)
    val wr = new BufferedWriter(new OutputStreamWriter(conn.getOutputStream, "UTF-8"))
    wr.write(json); wr.flush(); wr.close()
    val code = conn.getResponseCode
    conn.disconnect()
    code
  }

  /** Call this near job end */
  def sendRunMetrics(spark: SparkSession,
                     endpoint: String,
                     token: Option[String] = None,
                     startedAtMillis: Long,
                     bytesRead: Long,
                     bytesWritten: Long,
                     rowsProcessed: Long): Unit = {

    val conf = spark.sparkContext.getConf

    val cloud = sys.env.getOrElse("VERDANTOPS_CLOUD", "azure")        // or infer from workspace tags
    val region = sys.env.getOrElse("VERDANTOPS_REGION", "eastus")
    val computeType = Option(sys.env.getOrElse("VERDANTOPS_COMPUTE_TYPE", "Standard_D8ds_v5"))
    val nodeCount = Try(conf.get("spark.databricks.cluster.numWorkers").toInt).toOption.orElse(Some(2))
    val avgCpuUtil = Try(conf.get("spark.executor.cores").toDouble).toOption.map(_ => 55.0) // placeholder
    val dbu = Try(conf.get("spark.databricks.clusterUsageTags.clusterUsage").toDouble).toOption

    val now = System.currentTimeMillis()

    // Extremely rough kWh estimate on the driver if you want to compute here:
    val hours = (now - startedAtMillis).toDouble / 3600000.0
    val wattsPerNode = 180.0
    val util = avgCpuUtil.getOrElse(55.0) / 100.0
    val estKWh = Some(nodeCount.getOrElse(2) * hours * (wattsPerNode / 1000.0) * util)

    val payload = UsagePayload(
      runId = Try(conf.get("spark.app.id")).toOption,
      cloud = cloud,
      regionCode = region,
      computeType = computeType,
      nodeCount = nodeCount,
      avgCpuUtilization = avgCpuUtil,
      startedAt = Instant.ofEpochMilli(startedAtMillis).toString,
      endedAt = Instant.ofEpochMilli(now).toString,
      dbu = dbu,
      bytesRead = Some(bytesRead),
      bytesWritten = Some(bytesWritten),
      rowsProcessed = Some(rowsProcessed),
      estKWh = estKWh
    )

    val json =
      s"""
      {
        "source":"databricks",
        "runId": ${payload.runId.map("\""+_+"\"").getOrElse("null")},
        "cloud": "${payload.cloud}",
        "regionCode": "${payload.regionCode}",
        "computeType": ${payload.computeType.map("\""+_+"\"").getOrElse("null")},
        "nodeCount": ${payload.nodeCount.getOrElse(2)},
        "avgCpuUtilization": ${payload.avgCpuUtilization.getOrElse(55.0)},
        "startedAt": "${payload.startedAt}",
        "endedAt": "${payload.endedAt}",
        "dbu": ${payload.dbu.getOrElse(0.0)},
        "bytesRead": ${payload.bytesRead.getOrElse(0L)},
        "bytesWritten": ${payload.bytesWritten.getOrElse(0L)},
        "rowsProcessed": ${payload.rowsProcessed.getOrElse(0L)},
        "estKWh": ${payload.estKWh.getOrElse(0.0)}
      }
      """.stripMargin

    val code = postJson(endpoint, token, json)
    println(s"[Verdantops] Ingest response code: $code")
  }
}

ThisBuild / version := "0.1.0"
ThisBuild / scalaVersion := "2.12.18"


lazy val root = (project in file(".")).settings(
name := "verdantops-dbx-collector",
libraryDependencies ++= Seq(
"org.apache.spark" %% "spark-core" % sys.env.getOrElse("SPARK_VERSION", "3.5.1"),
"org.apache.spark" %% "spark-sql" % sys.env.getOrElse("SPARK_VERSION", "3.5.1"),
"com.softwaremill.sttp.client3" %% "core" % "3.9.5",
"io.circe" %% "circe-core" % "0.14.9",
"io.circe" %% "circe-generic" % "0.14.9",
"io.circe" %% "circe-parser" % "0.14.9"
)
)
